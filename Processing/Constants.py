"""
Project-wide constants. Anything with a hardcoded, semantic value lives here
so it's not duplicated across modules and so its single home is easy to find.

This intentionally does NOT include column-header tokens — those live in
Headers.py, which is already cleanly separated.
"""
from Headers import Helpers

KEYWORDS = {
    "center":     "מרכז",
    "deductions": "ניכוי",
    "absences":   "העדר",
    "providents": "גמל",
    "components": "רכיב",
    "income":     "הכנס",
    "costing":    "תמחיר",
}

DISPLAY_NAMES = {
    "center":     "קובץ מרכז שכר",
    "deductions": "ניכויי רשות",
    "absences":   "היעדרויות",
    "providents": "קופות גמל",
    "components": "רכיבי שכר",
    "income":     "הכנסות זקופות",
    "costing":    "דוח תמחיר",
}

JOIN_KEY   = 'מפתח_עובד_חודש'
KEY_REGEX  = r'^(.+)-(\d{1,2})-(\d{4})$'

GROUP_LIST = [
    JOIN_KEY,
    Helpers.SystemReportsBase.work_year,
    Helpers.SystemReportsBase.work_month,
    Helpers.SystemReportsBase.employee_id,
]
