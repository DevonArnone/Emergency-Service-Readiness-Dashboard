"""Keep short-lived upgrade credentials out of server request logs."""
import logging
import re


class RedactTicketFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        def redact(value):
            return re.sub(r"([?&]ticket=)[^\s\"&]+", r"\1[redacted]", value) if isinstance(value, str) else value
        record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(redact(value) for value in record.args)
        return True


def protect_request_logs() -> None:
    for name in ("uvicorn.access", "uvicorn.error"):
        logging.getLogger(name).addFilter(RedactTicketFilter())
