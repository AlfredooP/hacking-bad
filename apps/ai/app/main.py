import os
from fastapi import FastAPI, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

app = FastAPI(title="BIN AI Service", version="1.0.0")

AI_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")


def verify_internal_token(x_internal_token: str = Header(...)):
    if not AI_TOKEN or x_internal_token != AI_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")
    return True


class ContainerInput(BaseModel):
    containerId: int
    tempCelsius: float | None = None
    humedad: float | None = None
    distanciaBoteTapa: float | None = None
    pesoKg: float | None = None
    capacidadLitros: float | None = None


class ClassifyRequest(BaseModel):
    containers: list[ContainerInput]


class ClassifyResult(BaseModel):
    containerId: int
    prioridad: Literal["alta", "media", "baja"]
    score: float = Field(ge=0, le=1)
    volumenPct: float = Field(ge=0, le=100)
    temperatura: float | None = None
    humedad: float | None = None
    pesoKg: float | None = None


class ClassifyResponse(BaseModel):
    results: list[ClassifyResult]


def estimate_volume(c: ContainerInput) -> float:
    if c.distanciaBoteTapa is not None and 0 < c.distanciaBoteTapa < 400:
        return min(100.0, max(0.0, (1 - c.distanciaBoteTapa / 200) * 100))
    if c.pesoKg is not None and c.pesoKg > 0:
        cap = c.capacidadLitros if c.capacidadLitros and c.capacidadLitros > 0 else 50
        return min(100.0, (c.pesoKg / cap) * 100)
    return 0.0


def classify_one(c: ContainerInput) -> ClassifyResult:
    vol = estimate_volume(c)
    if vol >= 80:
        prioridad = "alta"
        score = 0.92
    elif vol >= 50:
        prioridad = "media"
        score = 0.78
    else:
        prioridad = "baja"
        score = 0.65

    if c.tempCelsius is not None and c.tempCelsius > 45:
        prioridad = "alta"
        score = max(score, 0.88)

    return ClassifyResult(
        containerId=c.containerId,
        prioridad=prioridad,
        score=score,
        volumenPct=round(vol, 2),
        temperatura=c.tempCelsius,
        humedad=c.humedad,
        pesoKg=c.pesoKg,
    )


@app.get("/health")
def health():
    return {"status": "ok", "service": "bin-ai"}


@app.post("/internal/v1/classify", response_model=ClassifyResponse)
def classify(
    body: ClassifyRequest,
    _: bool = Depends(verify_internal_token),
):
    results = [classify_one(c) for c in body.containers]
    return ClassifyResponse(results=results)


class OptimizeContainerInput(BaseModel):
    id: int
    latitud: float
    longitud: float
    volumenPct: float
    prioridad: str
    tipoResiduo: str


class OptimizeTruckInput(BaseModel):
    id: int
    latitud: float
    longitud: float
    capacidadDisponible: float
    tipoResiduos: str


class OptimizeRequest(BaseModel):
    containers: list[OptimizeContainerInput]
    trucks: list[OptimizeTruckInput]


class OptimizeMetrics(BaseModel):
    totalContainers: int
    estimatedVolume: float
    urgencyScore: float


class OptimizeResponse(BaseModel):
    truckId: int | None
    route: list[int]
    metrics: OptimizeMetrics


import math

@app.post("/internal/v1/optimize-route", response_model=OptimizeResponse)
def optimize_route(
    body: OptimizeRequest,
    _: bool = Depends(verify_internal_token),
):
    # 1. Identify critical containers (e.g., volumenPct >= 70 or priority in ["alta", "media"])
    critical = [c for c in body.containers if c.volumenPct >= 70 or c.prioridad in ["alta", "media"]]

    if not critical or not body.trucks:
        return OptimizeResponse(
            truckId=body.trucks[0].id if body.trucks else None,
            route=[],
            metrics=OptimizeMetrics(totalContainers=0, estimatedVolume=0.0, urgencyScore=0.0),
        )

    # Sort critical containers by volume descending as initial priority
    critical.sort(key=lambda x: x.volumenPct, reverse=True)

    # 2. Select the best truck
    # We find the truck that can handle the most urgent container and is closest to it
    most_urgent = critical[0]
    best_truck = None
    min_dist = float("inf")

    for t in body.trucks:
        # Check compatibility
        compat_types = [x.strip().lower() for x in t.tipoResiduos.split(",")]
        if most_urgent.tipoResiduo.lower() in compat_types:
            dist = math.sqrt((t.latitud - most_urgent.latitud) ** 2 + (t.longitud - most_urgent.longitud) ** 2)
            if dist < min_dist:
                min_dist = dist
                best_truck = t

    if not best_truck:
        # Fallback to the first truck if no perfect match
        best_truck = body.trucks[0]

    # Get compatible types for selected truck
    truck_compat_types = [x.strip().lower() for x in best_truck.tipoResiduos.split(",")]

    # Filter critical containers compatible with selected truck
    compat_containers = [c for c in critical if c.tipoResiduo.lower() in truck_compat_types]

    # 3. Greedy TSP path starting from best_truck position
    curr_lat = best_truck.latitud
    curr_lng = best_truck.longitud
    remaining_cap = best_truck.capacidadDisponible

    route = []
    total_volume_collected = 0.0

    unvisited = list(compat_containers)
    while unvisited:
        best_next = None
        best_idx = -1
        min_d = float("inf")

        for idx, c in enumerate(unvisited):
            # Calculate weight: volume percentage * capacity (assume 150kg avg capacity)
            est_weight = (c.volumenPct / 100.0) * 150.0

            # Check capacity
            if est_weight > remaining_cap:
                continue

            dist = math.sqrt((c.latitud - curr_lat) ** 2 + (c.longitud - curr_lng) ** 2)
            # Prioritize distance but also give weight to volume pct
            score = dist / (1.0 + (c.volumenPct / 100.0))
            if score < min_d:
                min_d = score
                best_next = c
                best_idx = idx

        if not best_next:
            # No more containers fit in the truck capacity
            break

        unvisited.pop(best_idx)
        route.append(best_next.id)
        est_weight = (best_next.volumenPct / 100.0) * 150.0
        remaining_cap -= est_weight
        total_volume_collected += best_next.volumenPct
        curr_lat = best_next.latitud
        curr_lng = best_next.longitud

    # Urgency Score: average volume pct of routed containers
    urgency_score = (
        sum(c.volumenPct for c in compat_containers if c.id in route) / len(route) if route else 0.0
    )

    return OptimizeResponse(
        truckId=best_truck.id,
        route=route,
        metrics=OptimizeMetrics(
            totalContainers=len(route),
            estimatedVolume=round(total_volume_collected / len(route) if route else 0.0, 2),
            urgencyScore=round(urgency_score, 2),
        ),
    )
