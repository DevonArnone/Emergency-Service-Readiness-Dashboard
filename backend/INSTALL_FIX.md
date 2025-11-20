# Installation Fix for Python 3.13

You're encountering build issues because:
1. **confluent-kafka** needs the `librdkafka` C library
2. **pydantic** 2.5.0 has compatibility issues with Python 3.13

## Quick Fix Options

### Option 1: Install librdkafka and use updated pydantic (Recommended)

```bash
# Install librdkafka via Homebrew
brew install librdkafka

# Then install Python dependencies
pip install -r requirements.txt
```

### Option 2: Skip Kafka for now (Use Mock Service)

The app will work fine without Kafka - it uses a mock service. You can:

1. Install everything except confluent-kafka:
```bash
pip install fastapi uvicorn[standard] "pydantic>=2.10.0" pydantic-settings websockets python-dotenv python-jose[cryptography] passlib[bcrypt] sqlalchemy aiosqlite snowflake-connector-python snowflake-sqlalchemy
```

2. Or comment out confluent-kafka in requirements.txt temporarily

### Option 3: Use Python 3.11 or 3.12 (Most Compatible)

If you have issues, Python 3.11 or 3.12 work better with these packages:

```bash
# Create new venv with Python 3.11/3.12
python3.11 -m venv venv  # or python3.12
source venv/bin/activate
pip install -r requirements.txt
```

## What I've Updated

- Updated `pydantic` to `>=2.10.0` which has better Python 3.13 support
- The requirements.txt now uses flexible versions for pydantic

Try Option 1 first (install librdkafka), then run `pip install -r requirements.txt` again.

