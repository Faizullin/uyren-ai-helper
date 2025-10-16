from fastapi import HTTPException, Request

from app.core.db import DBConnection


async def verify_and_get_user_id_from_jwt(request: Request) -> str:
    x_api_key = request.headers.get("x-api-key")

    if x_api_key:
        try:
            if ":" not in x_api_key:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid API key format. Expected format: pk_xxx:sk_xxx",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            public_key, secret_key = x_api_key.split(":", 1)

            db = DBConnection()
            await db.initialize()
            api_key_service = APIKeyService(db)

            validation_result = await api_key_service.validate_api_key(
                public_key, secret_key
            )

            if validation_result.is_valid:
                user_id = await _get_user_id_from_account_cached(
                    str(validation_result.id)
                )

                if user_id:
                    sentry.sentry.set_user({"id": user_id})
                    structlog.contextvars.bind_contextvars(
                        user_id=user_id,
                        auth_method="api_key",
                        api_key_id=str(validation_result.key_id),
                        public_key=public_key,
                    )
                    return user_id
                else:
                    raise HTTPException(
                        status_code=401,
                        detail="API key account not found",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
            else:
                raise HTTPException(
                    status_code=401,
                    detail=f"Invalid API key: {validation_result.error_message}",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except HTTPException:
            raise
        except Exception as e:
            structlog.get_logger().error(f"Error validating API key: {e}")
            raise HTTPException(
                status_code=401,
                detail="API key validation failed",
                headers={"WWW-Authenticate": "Bearer"},
            )

    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="No valid authentication credentials found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ")[1]

    try:
        payload = _decode_jwt_safely(token)
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )

        sentry.sentry.set_user({"id": user_id})
        structlog.contextvars.bind_contextvars(user_id=user_id, auth_method="jwt")
        return user_id

    except PyJWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_user_id_from_stream_auth(
    request: Request, token: str | None = None
) -> str:
    try:
        try:
            return await verify_and_get_user_id_from_jwt(request)
        except HTTPException:
            pass

        if token:
            try:
                payload = _decode_jwt_safely(token)
                user_id = payload.get("sub")
                if user_id:
                    sentry.sentry.set_user({"id": user_id})
                    structlog.contextvars.bind_contextvars(
                        user_id=user_id, auth_method="jwt_query"
                    )
                    return user_id
            except Exception:
                pass

        raise HTTPException(
            status_code=401,
            detail="No valid authentication credentials found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if (
            "cannot schedule new futures after shutdown" in error_msg
            or "connection is closed" in error_msg
        ):
            raise HTTPException(status_code=503, detail="Server is shutting down")
        else:
            raise HTTPException(
                status_code=500, detail=f"Error during authentication: {str(e)}"
            )
