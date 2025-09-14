FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV CONTAINER_HOME=/app

WORKDIR $CONTAINER_HOME

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/tmp/uv-cache \
    uv sync --frozen --no-dev

COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]