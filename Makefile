.PHONY: check-harness test-backend check

check-harness:
	python3 scripts/check_harness.py

test-backend:
	cd backend && python -m unittest discover -s tests -v

check: check-harness test-backend
	cd dashboard && npm run lint && npm run build
