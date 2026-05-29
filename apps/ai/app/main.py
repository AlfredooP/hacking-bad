import os
from fastapi import FastAPI, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

app = FastAPI(title="BIN AI Service", version="1.1.0")

AI_TOKEN = os.getenv("AI_SERVICE_TOKEN", "")

# Umbrales de inferencia por sensor
HUM_ALTA = 55.0
HUM_BAJA = 35.0
DENS_BAJA = 0.35
DENS_MEDIA = 0.75

WASTE_COMPAT = {
    "Orgánicos": {"Orgánicos", "Orgánico"},
    "Inorgánicos": {"Inorgánicos", "Vidrio/Metal", "Metales pesados"},
    "Reciclables": {"Reciclables", "Plástico", "Papel/Cartón"},
    "Plástico": {"Reciclables", "Plástico"},
    "Papel/Cartón": {"Reciclables", "Papel/Cartón"},
    "Vidrio/Metal": {"Inorgánicos", "Vidrio/Metal", "Metales pesados"},
    "Químicos": {"Químicos", "Residuos especiales"},
    "Metales pesados": {"Metales pesados", "Vidrio/Metal", "Inorgánicos"},
    "Residuos especiales": {"Residuos especiales", "Químicos"},
}


def verify_internal_token(x_internal_token: str = Header(...)):
    if not AI_TOKEN or x_internal_token != AI_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")
    return True


class ContainerInput(BaseModel):
    containerId: int
    tempCelsius: float | None = None
    humedad: float | None = None
    densidad: float | None = None
    distanciaBoteTapa: float | None = None
    pesoKg: float | None = None
    capacidadLitros: float | None = None
    tipoResiduoEsperado: str | None = None
    tiposResiduosPermitidos: list[str] = Field(default_factory=list)
    prioridadConfigurada: Literal["alta", "media", "baja"] | None = None


class ClassifyRequest(BaseModel):
    containers: list[ContainerInput]


class ClassifyResult(BaseModel):
    containerId: int
    prioridad: Literal["alta", "media", "baja"]
    score: float = Field(ge=0, le=1)
    volumenPct: float = Field(ge=0, le=100)
    temperatura: float | None = None
    humedad: float | None = None
    densidad: float | None = None
    pesoKg: float | None = None
    tipoResiduoInferido: str | None = None
    confianzaInferencia: float | None = None
    contaminacionDetectada: bool = False
    mensajeContaminacion: str | None = None


class ClassifyResponse(BaseModel):
    results: list[ClassifyResult]


def estimate_volume(c: ContainerInput) -> float:
    if c.distanciaBoteTapa is not None and 0 < c.distanciaBoteTapa < 400:
        return min(100.0, max(0.0, (1 - c.distanciaBoteTapa / 200) * 100))
    if c.pesoKg is not None and c.pesoKg > 0:
        cap = c.capacidadLitros if c.capacidadLitros and c.capacidadLitros > 0 else 50
        return min(100.0, (c.pesoKg / cap) * 100)
    return 0.0


def estimate_density(c: ContainerInput, vol_pct: float) -> float | None:
    if c.densidad is not None and c.densidad > 0:
        return c.densidad
    if c.pesoKg is not None and c.pesoKg > 0 and vol_pct > 5:
        cap = c.capacidadLitros if c.capacidadLitros and c.capacidadLitros > 0 else 50
        volume_liters = cap * (vol_pct / 100.0)
        if volume_liters > 0:
            return round(c.pesoKg / volume_liters, 3)
    return None


def infer_waste_type(humedad: float | None, densidad: float | None) -> tuple[str | None, float]:
    """Reglas de inferencia: humedad + densidad → tipo de residuo."""
    if humedad is None or densidad is None:
        return None, 0.0

    hum_alta = humedad >= HUM_ALTA
    hum_baja = humedad <= HUM_BAJA
    dens_baja = densidad < DENS_BAJA
    dens_media = DENS_BAJA <= densidad < DENS_MEDIA
    dens_alta = densidad >= DENS_MEDIA

    if hum_alta and dens_alta:
        return "Orgánicos", 0.88
    if hum_baja and dens_baja:
        return "Plástico", 0.82
    if hum_baja and dens_media:
        return "Papel/Cartón", 0.80
    if hum_baja and dens_alta:
        return "Vidrio/Metal", 0.85
    if humedad > HUM_BAJA and dens_baja:
        return "Plástico", 0.65
    if humedad > HUM_BAJA and dens_alta:
        return "Orgánicos", 0.60
    return "Reciclables", 0.55


def is_compatible(inferred: str, allowed: list[str]) -> bool:
    if not allowed:
        return True
    inferred_set = WASTE_COMPAT.get(inferred, {inferred})
    for a in allowed:
        allowed_set = WASTE_COMPAT.get(a, {a})
        if inferred_set & allowed_set:
            return True
        if inferred.lower() == a.lower():
            return True
    return False


def max_priority(a: str, b: str) -> Literal["alta", "media", "baja"]:
    rank = {"baja": 0, "media": 1, "alta": 2}
    return a if rank.get(a, 0) >= rank.get(b, 0) else b  # type: ignore


def classify_one(c: ContainerInput) -> ClassifyResult:
    vol = estimate_volume(c)
    dens = estimate_density(c, vol)

    if vol >= 80:
        prioridad: Literal["alta", "media", "baja"] = "alta"
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

    if c.prioridadConfigurada:
        prioridad = max_priority(prioridad, c.prioridadConfigurada)

    tipo_inferido, confianza = infer_waste_type(c.humedad, dens)

    contaminacion = False
    mensaje = None
    allowed = c.tiposResiduosPermitidos or (
        [c.tipoResiduoEsperado] if c.tipoResiduoEsperado else []
    )

    if tipo_inferido and allowed and not is_compatible(tipo_inferido, allowed):
        contaminacion = True
        esperado = ", ".join(allowed)
        mensaje = (
            f"Contaminación detectada: se esperaba [{esperado}] "
            f"pero los sensores sugieren [{tipo_inferido}]"
        )
        prioridad = "alta"
        score = max(score, 0.95)

    return ClassifyResult(
        containerId=c.containerId,
        prioridad=prioridad,
        score=score,
        volumenPct=round(vol, 2),
        temperatura=c.tempCelsius,
        humedad=c.humedad,
        densidad=dens,
        pesoKg=c.pesoKg,
        tipoResiduoInferido=tipo_inferido,
        confianzaInferencia=confianza if tipo_inferido else None,
        contaminacionDetectada=contaminacion,
        mensajeContaminacion=mensaje,
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
    tipoResiduoInferido: str | None = None
    contaminacionDetectada: bool = False
    capacidadMax: float | None = None


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


def effective_waste_type(c: OptimizeContainerInput) -> str:
    if c.contaminacionDetectada and c.tipoResiduoInferido:
        return c.tipoResiduoInferido
    if c.tipoResiduoInferido and not c.contaminacionDetectada:
        return c.tipoResiduoInferido
    return c.tipoResiduo


def priority_rank(p: str) -> int:
    return {"alta": 3, "media": 2, "baja": 1}.get(p, 1)


@app.post("/internal/v1/optimize-route", response_model=OptimizeResponse)
def optimize_route(
    body: OptimizeRequest,
    _: bool = Depends(verify_internal_token),
):
    active = [
        c
        for c in body.containers
        if c.volumenPct >= 50
        or c.prioridad in ["alta", "media"]
        or c.contaminacionDetectada
    ]

    if not active or not body.trucks:
        return OptimizeResponse(
            truckId=body.trucks[0].id if body.trucks else None,
            route=[],
            metrics=OptimizeMetrics(totalContainers=0, estimatedVolume=0.0, urgencyScore=0.0),
        )

    active.sort(
        key=lambda x: (
            x.contaminacionDetectada,
            priority_rank(x.prioridad),
            x.volumenPct,
        ),
        reverse=True,
    )

    most_urgent = active[0]
    waste_needed = effective_waste_type(most_urgent).lower()
    best_truck = None
    min_dist = float("inf")

    for t in body.trucks:
        compat_types = [x.strip().lower() for x in t.tipoResiduos.split(",")]
        if waste_needed in compat_types or any(
            waste_needed in WASTE_COMPAT.get(ct.title(), {ct}) for ct in compat_types
        ):
            dist = math.sqrt(
                (t.latitud - most_urgent.latitud) ** 2
                + (t.longitud - most_urgent.longitud) ** 2
            )
            if dist < min_dist:
                min_dist = dist
                best_truck = t

    if not best_truck:
        best_truck = body.trucks[0]

    truck_compat_types = [x.strip().lower() for x in best_truck.tipoResiduos.split(",")]

    compat_containers = []
    for c in active:
        wt = effective_waste_type(c).lower()
        if wt in truck_compat_types:
            compat_containers.append(c)
        else:
            for ct in truck_compat_types:
                if wt in {x.lower() for x in WASTE_COMPAT.get(ct.title(), {ct})}:
                    compat_containers.append(c)
                    break

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
            cap = c.capacidadMax if c.capacidadMax and c.capacidadMax > 0 else 150.0
            est_weight = (c.volumenPct / 100.0) * cap * 0.5

            if est_weight > remaining_cap:
                continue

            dist = math.sqrt((c.latitud - curr_lat) ** 2 + (c.longitud - curr_lng) ** 2)
            urgency = priority_rank(c.prioridad) + (2 if c.contaminacionDetectada else 0)
            score = dist / (1.0 + urgency + (c.volumenPct / 100.0))
            if score < min_d:
                min_d = score
                best_next = c
                best_idx = idx

        if not best_next:
            break

        unvisited.pop(best_idx)
        route.append(best_next.id)
        cap = best_next.capacidadMax if best_next.capacidadMax and best_next.capacidadMax > 0 else 150.0
        est_weight = (best_next.volumenPct / 100.0) * cap * 0.5
        remaining_cap -= est_weight
        total_volume_collected += best_next.volumenPct
        curr_lat = best_next.latitud
        curr_lng = best_next.longitud

    urgency_score = (
        sum(c.volumenPct for c in compat_containers if c.id in route) / len(route)
        if route
        else 0.0
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
