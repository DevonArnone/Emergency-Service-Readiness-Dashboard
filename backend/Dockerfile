FROM python:3.11-slim AS runtime

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY data ./data
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations

RUN groupadd --system aegis && useradd --system --gid aegis --home /app aegis \
    && chown -R aegis:aegis /app

USER aegis

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
