"""External services."""

from app.services.email import (
    EmailData,
    generate_new_account_email,
    generate_reset_password_email,
    generate_test_email,
    render_email_template,
    send_email,
)

__all__ = [
    "EmailData",
    "send_email",
    "render_email_template",
    "generate_test_email",
    "generate_reset_password_email",
    "generate_new_account_email",
]

