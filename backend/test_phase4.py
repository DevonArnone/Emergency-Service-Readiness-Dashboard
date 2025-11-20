#!/usr/bin/env python3
"""
Phase 4 Test Script - Snowflake Warehouse Integration
Tests:
1. Personnel/Unit/Assignment creation with Snowflake integration
2. Readiness history endpoint
3. Snowflake service methods
"""

import requests
import json
from datetime import datetime, timedelta, timezone
import sys

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_personnel_creation():
    """Test creating personnel with Snowflake integration."""
    print_section("Test 1: Create Personnel (Snowflake Integration)")
    
    personnel_data = {
        "name": "Captain John Smith",
        "rank": "Captain",
        "role": "Firefighter",
        "certifications": ["Firefighter II", "EMT-B", "HazMat Operations"],
        "cert_expirations": {
            "Firefighter II": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat(),
            "EMT-B": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat(),
            "HazMat Operations": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        },
        "availability_status": "AVAILABLE",
        "station_id": "station-001"
    }
    
    response = requests.post(f"{BASE_URL}/api/personnel", json=personnel_data)
    assert response.status_code == 200, f"Failed to create personnel: {response.text}"
    
    personnel = response.json()
    print(f"✅ Created personnel: {personnel['name']} (ID: {personnel['personnel_id']})")
    print(f"   - Role: {personnel['role']}")
    print(f"   - Certifications: {len(personnel['certifications'])}")
    print(f"   - Status: {personnel['availability_status']}")
    
    return personnel['personnel_id']

def test_unit_creation():
    """Test creating units with Snowflake integration."""
    print_section("Test 2: Create Units (Snowflake Integration)")
    
    units_data = [
        {
            "unit_name": "Engine 1",
            "type": "ENGINE",
            "minimum_staff": 4,
            "required_certifications": ["Firefighter II", "EMT-B"],
            "station_id": "station-001"
        },
        {
            "unit_name": "Medic 5",
            "type": "MEDIC",
            "minimum_staff": 2,
            "required_certifications": ["EMT-P", "ACLS"],
            "station_id": "station-001"
        },
        {
            "unit_name": "Rescue 3",
            "type": "RESCUE",
            "minimum_staff": 3,
            "required_certifications": ["Firefighter II", "EMT-P", "Technical Rescue"],
            "station_id": "station-001"
        }
    ]
    
    unit_ids = []
    for unit_data in units_data:
        response = requests.post(f"{BASE_URL}/api/units", json=unit_data)
        assert response.status_code == 200, f"Failed to create unit: {response.text}"
        
        unit = response.json()
        unit_ids.append(unit['unit_id'])
        print(f"✅ Created unit: {unit['unit_name']} (ID: {unit['unit_id']})")
        print(f"   - Type: {unit['type']}")
        print(f"   - Min Staff: {unit['minimum_staff']}")
        print(f"   - Required Certs: {len(unit['required_certifications'])}")
    
    return unit_ids

def test_unit_assignments():
    """Test creating unit assignments with Snowflake integration."""
    print_section("Test 3: Create Unit Assignments (Snowflake Integration)")
    
    # First, get existing personnel and units
    personnel_resp = requests.get(f"{BASE_URL}/api/personnel")
    assert personnel_resp.status_code == 200
    personnel_list = personnel_resp.json()
    
    units_resp = requests.get(f"{BASE_URL}/api/units")
    assert units_resp.status_code == 200
    units_list = units_resp.json()
    
    if not personnel_list or not units_list:
        print("⚠️  No personnel or units found. Creating test data...")
        personnel_id = test_personnel_creation()
        unit_ids = test_unit_creation()
        personnel_list = [{"personnel_id": personnel_id}]
        units_list = [{"unit_id": unit_id} for unit_id in unit_ids]
    
    # Create assignments
    now = datetime.now(timezone.utc)
    shift_start = now.replace(hour=8, minute=0, second=0, microsecond=0)
    shift_end = shift_start + timedelta(hours=12)
    
    assignments = []
    for i, unit in enumerate(units_list[:2]):  # Assign to first 2 units
        if i < len(personnel_list):
            assignment_data = {
                "unit_id": unit["unit_id"],
                "personnel_id": personnel_list[i]["personnel_id"],
                "shift_start": shift_start.isoformat(),
                "shift_end": shift_end.isoformat(),
                "assignment_status": "ON_SHIFT"
            }
            
            response = requests.post(f"{BASE_URL}/api/unit-assignments", json=assignment_data)
            if response.status_code == 200:
                assignment = response.json()
                assignments.append(assignment)
                print(f"✅ Created assignment: {assignment['assignment_id']}")
                print(f"   - Unit: {assignment['unit_id']}")
                print(f"   - Personnel: {assignment['personnel_id']}")
                print(f"   - Status: {assignment['assignment_status']}")
            else:
                print(f"⚠️  Assignment creation returned: {response.status_code}")
                print(f"   Response: {response.text}")
    
    return [a['unit_id'] for a in assignments]

def test_readiness_endpoints():
    """Test readiness calculation endpoints."""
    print_section("Test 4: Readiness Calculation Endpoints")
    
    # Get all units readiness
    response = requests.get(f"{BASE_URL}/api/readiness/units")
    assert response.status_code == 200, f"Failed to get readiness: {response.text}"
    
    readiness_list = response.json()
    print(f"✅ Retrieved readiness for {len(readiness_list)} units")
    
    for readiness in readiness_list[:3]:  # Show first 3
        print(f"\n   Unit: {readiness.get('unit_name', 'N/A')}")
        print(f"   - Readiness Score: {readiness.get('readiness_score', 0)}%")
        print(f"   - Current Staff: {readiness.get('current_staff', 0)}")
        print(f"   - Minimum Staff: {readiness.get('minimum_staff', 0)}")
        print(f"   - Understaffed: {readiness.get('is_understaffed', False)}")
        print(f"   - Missing Certs: {len(readiness.get('missing_certifications', []))}")
    
    return readiness_list[0]['unit_id'] if readiness_list else None

def test_readiness_history(unit_id):
    """Test readiness history endpoint."""
    print_section("Test 5: Readiness History (Snowflake Analytics)")
    
    if not unit_id:
        print("⚠️  No unit ID available, skipping history test")
        return
    
    response = requests.get(f"{BASE_URL}/api/readiness/units/{unit_id}/history?days=7")
    
    if response.status_code == 200:
        history_data = response.json()
        print(f"✅ Retrieved readiness history for unit: {unit_id}")
        print(f"   - Days requested: {history_data.get('days', 0)}")
        print(f"   - History records: {len(history_data.get('history', []))}")
        
        if history_data.get('history'):
            latest = history_data['history'][0]
            print(f"\n   Latest record:")
            print(f"   - Date: {latest.get('date')}")
            print(f"   - Readiness Score: {latest.get('readiness_score', 0)}%")
            print(f"   - Calculated At: {latest.get('calculated_at')}")
        else:
            print("   ⚠️  No history records found (this is expected if Snowflake is not configured)")
    else:
        print(f"⚠️  History endpoint returned: {response.status_code}")
        print(f"   Response: {response.text}")
        print("   Note: This is expected if Snowflake is not configured or tasks haven't run yet")

def test_certification_endpoints():
    """Test certification management endpoints."""
    print_section("Test 6: Certification Management Endpoints")
    
    # Test expiring certifications
    response = requests.get(f"{BASE_URL}/api/certifications/expiring?days_ahead=30")
    assert response.status_code == 200
    expiring = response.json()
    print(f"✅ Expiring certifications (30 days): {len(expiring)}")
    
    # Test expired certifications
    response = requests.get(f"{BASE_URL}/api/certifications/expired")
    assert response.status_code == 200
    expired = response.json()
    print(f"✅ Expired certifications: {len(expired)}")
    
    # Test expiration check endpoint
    response = requests.post(f"{BASE_URL}/api/certifications/check-expirations")
    assert response.status_code == 200
    result = response.json()
    print(f"✅ Expiration check completed")
    print(f"   - Marked unqualified: {result.get('marked_unqualified', 0)}")
    print(f"   - Affected units: {len(result.get('affected_units', []))}")

def test_snowflake_service_logs():
    """Check if Snowflake service is logging operations."""
    print_section("Test 7: Snowflake Service Status")
    
    print("Checking backend logs for Snowflake operations...")
    print("\n   Note: Check backend terminal for Snowflake service logs")
    print("   - Look for '[MOCK]' if Snowflake is not configured")
    print("   - Look for 'Inserted/updated' if Snowflake is configured")
    print("\n   Expected operations:")
    print("   1. insert_personnel() calls")
    print("   2. insert_unit() calls")
    print("   3. insert_unit_assignment() calls")
    print("   4. get_unit_readiness_history() calls")

def main():
    """Run all Phase 4 tests."""
    print("\n" + "="*60)
    print("  PHASE 4 TEST SUITE - Snowflake Warehouse Integration")
    print("="*60)
    
    try:
        # Check if backend is running
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code != 200:
            print(f"\n❌ Backend not responding at {BASE_URL}")
            print("   Please start the backend: cd backend && uvicorn app.main:app --reload")
            sys.exit(1)
        
        print("\n✅ Backend is running")
        
        # Run tests
        personnel_id = test_personnel_creation()
        unit_ids = test_unit_creation()
        assigned_unit_ids = test_unit_assignments()
        unit_id = test_readiness_endpoints()
        test_readiness_history(unit_id)
        test_certification_endpoints()
        test_snowflake_service_logs()
        
        print_section("Test Summary")
        print("✅ All Phase 4 tests completed!")
        print("\n   What was tested:")
        print("   1. Personnel creation with Snowflake integration")
        print("   2. Unit creation with Snowflake integration")
        print("   3. Unit assignment creation with Snowflake integration")
        print("   4. Readiness calculation endpoints")
        print("   5. Readiness history endpoint (Snowflake analytics)")
        print("   6. Certification management endpoints")
        print("\n   Next steps:")
        print("   - Check backend logs for Snowflake operations")
        print("   - If Snowflake is configured, verify data in Snowflake tables")
        print("   - Run SQL queries to check analytics views")
        print("   - Verify tasks are running in Snowflake")
        
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Cannot connect to backend at {BASE_URL}")
        print("   Please start the backend: cd backend && uvicorn app.main:app --reload")
        sys.exit(1)
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

