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
