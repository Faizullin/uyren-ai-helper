"""Structured logging configuration using structlog."""

import logging

import structlog

from app.core.config import settings

# Set default logging level based on environment
if settings.ENVIRONMENT.upper() == "PRODUCTION":
    default_level = "INFO"
else:
    default_level = "DEBUG"

LOGGING_LEVEL = logging.getLevelNamesMapping().get(
    settings.LOG_LEVEL.upper() if hasattr(settings, "LOG_LEVEL") else default_level,
    logging.DEBUG,
)

# Choose renderer based on environment
renderer = [structlog.processors.JSONRenderer()]
if settings.ENVIRONMENT.lower() in ["local", "staging"]:
    renderer = [structlog.dev.ConsoleRenderer(colors=True)]

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.dict_tracebacks,
        structlog.processors.CallsiteParameterAdder(
            {
                structlog.processors.CallsiteParameter.FILENAME,
                structlog.processors.CallsiteParameter.FUNC_NAME,
                structlog.processors.CallsiteParameter.LINENO,
            }
        ),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.contextvars.merge_contextvars,
        *renderer,
    ],
    cache_logger_on_first_use=True,
    wrapper_class=structlog.make_filtering_bound_logger(LOGGING_LEVEL),
)


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """
    Get a structlog logger instance.

    Args:
        name: Logger name (optional, usually __name__)

    Returns:
        Configured structlog BoundLogger instance
    """
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()


# Create application logger
logger: structlog.stdlib.BoundLogger = structlog.get_logger(__name__)
