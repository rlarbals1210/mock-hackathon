import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.dependencies import warmup_matching_services
from app.api.routes import router
from app.core.config import settings
from app.services.data_repository import DataNotReadyError
from app.services.matching_engine import CarrierNotFoundError, InvalidMatchRequestError, RouteNotFoundError

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 엑셀 파싱과 joblib 역직렬화를 기동 단계에서 끝내 첫 사용자 요청의
    # 6초 콜드스타트를 제거한다. 데이터가 필수인 배포에서는 실패를 조기에 드러낸다.
    app.state.matching_warmup = await asyncio.to_thread(warmup_matching_services)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


def error_response(
    status_code: int,
    code: str,
    message: str,
    request_id: str | None = None,
    details: list[dict[str, str]] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "requestId": request_id,
                "details": details or [],
            }
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for error in exc.errors():
        location = [str(value) for value in error.get("loc", ()) if value not in {"body", "query", "path"}]
        details.append({"field": ".".join(location), "reason": str(error.get("msg", "유효하지 않은 값입니다."))})
    return error_response(
        422,
        "VALIDATION_ERROR",
        "요청값을 확인해 주세요.",
        request.headers.get("x-request-id"),
        details,
    )


@app.exception_handler(CarrierNotFoundError)
async def carrier_not_found_handler(request: Request, exc: CarrierNotFoundError) -> JSONResponse:
    return error_response(404, "CARRIER_NOT_FOUND", f"운송인을 찾을 수 없습니다: {exc}")


@app.exception_handler(RouteNotFoundError)
async def route_not_found_handler(request: Request, exc: RouteNotFoundError) -> JSONResponse:
    return error_response(404, "CALL_NOT_FOUND", f"노선 정보를 찾을 수 없습니다: {exc}")


@app.exception_handler(InvalidMatchRequestError)
async def invalid_match_request_handler(request: Request, exc: InvalidMatchRequestError) -> JSONResponse:
    return error_response(400, "INVALID_REQUEST", str(exc))


@app.exception_handler(DataNotReadyError)
async def data_not_ready_handler(request: Request, exc: DataNotReadyError) -> JSONResponse:
    return error_response(503, "DATA_NOT_READY", str(exc))


@app.exception_handler(Exception)
async def internal_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(500, "INTERNAL_ERROR", "요청 처리 중 예상하지 못한 오류가 발생했습니다.")
