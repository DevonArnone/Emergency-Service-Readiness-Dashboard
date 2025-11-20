"""Service for managing certification expirations and alerts."""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from app.models import Personnel
from app.stores import personnel_store

logger = logging.getLogger(__name__)


class CertificationService:
    """Service for tracking and alerting on certification expirations."""
    
    @staticmethod
    def check_expiring_certifications(days_ahead: int = 30) -> List[Dict]:
        """
        Find certifications expiring within specified days.
        
        Args:
            days_ahead: Number of days to look ahead (default 30)
            
        Returns:
            List of dicts with personnel and expiring cert info
        """
        expiring = []
        cutoff_date = datetime.now(timezone.utc) + timedelta(days=days_ahead)
        
        for person in personnel_store.values():
            for cert_name, exp_date in person.cert_expirations.items():
                if isinstance(exp_date, str):
                    try:
                        exp_date = datetime.fromisoformat(exp_date.replace('Z', '+00:00'))
                    except:
                        continue
                
                if isinstance(exp_date, datetime):
                    if exp_date <= cutoff_date:
                        days_until_expiry = (exp_date - datetime.now(timezone.utc)).days
                        expiring.append({
                            "personnel_id": person.personnel_id,
                            "name": person.name,
                            "certification": cert_name,
                            "expiration_date": exp_date.isoformat(),
                            "days_until_expiry": days_until_expiry,
                            "is_expired": days_until_expiry < 0,
                        })
        
        return expiring
    
    @staticmethod
    def check_expired_certifications() -> List[Dict]:
        """Find all expired certifications."""
        expired = []
        now = datetime.now(timezone.utc)
        
        for person in personnel_store.values():
            for cert_name, exp_date in person.cert_expirations.items():
                if isinstance(exp_date, str):
                    try:
                        exp_date = datetime.fromisoformat(exp_date.replace('Z', '+00:00'))
                    except:
                        continue
                
                if isinstance(exp_date, datetime) and exp_date < now:
                    expired.append({
                        "personnel_id": person.personnel_id,
                        "name": person.name,
                        "certification": cert_name,
                        "expiration_date": exp_date.isoformat(),
                        "days_expired": (now - exp_date).days,
                    })
        
        return expired
    
    @staticmethod
    def mark_personnel_unqualified() -> int:
        """
        Mark personnel with expired certifications as unqualified.
        Updates availability_status to OFF if they have expired certs.
        
        Returns:
            Number of personnel marked as unqualified
        """
        expired = CertificationService.check_expired_certifications()
        marked_count = 0
        
        # Group by personnel
        personnel_expired = {}
        for item in expired:
            pid = item["personnel_id"]
            if pid not in personnel_expired:
                personnel_expired[pid] = []
            personnel_expired[pid].append(item["certification"])
        
        # Mark personnel as OFF if they have expired certs
        for personnel_id, expired_certs in personnel_expired.items():
            person = personnel_store.get(personnel_id)
            if person:
                person.availability_status = "OFF"
                person.notes = f"Unqualified: Expired certifications: {', '.join(expired_certs)}"
                personnel_store[personnel_id] = person
                marked_count += 1
                logger.warning(
                    f"Marked {person.name} as unqualified due to expired certifications: {', '.join(expired_certs)}"
                )
        
        return marked_count

