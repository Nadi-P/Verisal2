
class Helpers:
    class SystemReportsBase:
        work_year = r"שנת עבודה"
        employee_id = r"מספר עובד"
        employee_name = r"שם עובד"
        department_name = r"שם מחלקה"
        work_month = r"חודש עבודה"

        quarter = r"רבעון"
        half_year = r"חצי שנה"
        sub_department_name = r"שם תת מחלקה"
        id_number = r"מספר זהות"
        company_name = r"שם חברה"
        
    class ComponentsTypeReportsBase:
        component_code = r"קוד רכיב"
        component_name = r"שם רכיב"
        tarriff = r"תעריף"
        quantity = r"כמות"
        total_amount = r'סה"כ'
        fixed_value = r"ה. קבע"

    class AbsencesComponentsBase:
        vacation = r"חופש"
        sick = r"מחלה"
        convalescence = r"הבראה"
        reserve = r"מילואים"

        id = r"קוד "
        name = r"שם "
        opening_balance = r" - יתרת פתיחה"
        one_time_input = r" - קליטה חד פעמית"
        previous_balance = r" - יתרה קודמת"
        last_balance = r" - יתרה אחרונה"
        monthly_accrual = r" - צבירה חודשית"
        monthly_usage = r" - ניצול חודשי"
        monthly_balance = r" - יתרה חודשית"

class Headers:
    class InputFiles:

        class Components(Helpers.SystemReportsBase, Helpers.ComponentsTypeReportsBase):
            social_total = r'סהכ_רכיבים_לסוציאליות'

        class Deductions(Helpers.SystemReportsBase, Helpers.ComponentsTypeReportsBase):
            total_sum = r'סה"כ'

        class Income(Helpers.SystemReportsBase, Helpers.ComponentsTypeReportsBase):
            meals_gifts_total = r'שווי (ארוחות/מתנות)'

        class Absences(Helpers.SystemReportsBase):

            month = r"חודש"
            vacation_code = Helpers.AbsencesComponentsBase.id + Helpers.AbsencesComponentsBase.vacation
            vacation_name = Helpers.AbsencesComponentsBase.name + Helpers.AbsencesComponentsBase.vacation
            vacation_opening_balance = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.opening_balance
            vacation_one_time_input = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.one_time_input
            vacation_previous_balance = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.previous_balance
            vacation_last_balance = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.last_balance
            vacation_monthly_accrual = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.monthly_accrual
            vacation_monthly_usage = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.monthly_usage
            vacation_monthly_balance = Helpers.AbsencesComponentsBase.vacation + Helpers.AbsencesComponentsBase.monthly_balance

            sick_code = Helpers.AbsencesComponentsBase.id + Helpers.AbsencesComponentsBase.sick
            sick_name = Helpers.AbsencesComponentsBase.name + Helpers.AbsencesComponentsBase.sick
            sick_opening_balance = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.opening_balance
            sick_one_time_input = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.one_time_input
            sick_previous_balance = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.previous_balance
            sick_last_balance = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.last_balance
            sick_monthly_accrual = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.monthly_accrual
            sick_monthly_usage = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.monthly_usage
            sick_monthly_balance = Helpers.AbsencesComponentsBase.sick + Helpers.AbsencesComponentsBase.monthly_balance

            convalescence_code = Helpers.AbsencesComponentsBase.id + Helpers.AbsencesComponentsBase.convalescence
            convalescence_name = Helpers.AbsencesComponentsBase.name + Helpers.AbsencesComponentsBase.convalescence
            convalescence_opening_balance = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.opening_balance
            convalescence_one_time_input = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.one_time_input
            convalescence_previous_balance = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.previous_balance
            convalescence_last_balance = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.last_balance
            convalescence_monthly_accrual = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.monthly_accrual
            convalescence_monthly_usage = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.monthly_usage
            convalescence_monthly_balance = Helpers.AbsencesComponentsBase.convalescence + Helpers.AbsencesComponentsBase.monthly_balance

            reserve_monthly_usage = Helpers.AbsencesComponentsBase.reserve + Helpers.AbsencesComponentsBase.monthly_usage

        class Providents(Helpers.SystemReportsBase):
            fund_code = r"קוד קופה"
            fund_name = r"שם קופה"
            fund_type = r"סוג קופה"

            salary_for_pension = r"שכר לגמל"

            employee_pension = r"גמל עובד"
            employee_disability = r"א. כושר עובד"
            employee_other = r"שונות עובד"
            employee_total = r'סה"כ עובד'

            employer_pension = r"גמל מעסיק"
            employer_disability = r"א. כושר מעסיק"
            employer_other = r"שונות מעסיק"
            severance_pay = r"פיצויים"
            employer_total = r'סה"כ מעסיק'

            employee_employer_total = r'סה"כ עובד ומעסיק'

            member_number = r"מספר עמית"
            branch_number = r"מספר סניף"

            work_days = r"ימי עבודה"
            amount_indicator = r"ע. ע. סכומים"
            group = r"קבוצה"
    
        class Costing(Helpers.SystemReportsBase):
            gross_salary = r"ברוטו"
            employee_national_insurance = r"ב.ל. עובד"
            income_tax = r"מס הכנסה"
            employee_pension_study_fund = r"גמל + קה\"ל עובד"
            voluntary_deductions = r"ניכויי רשות"
            net_pay = r"נטו לתשלום"

            employer_national_insurance = r"ב.ל. מעסיק"
            employer_pension_study_fund = r"גמל + קה\"ל מעסיק"
            severance_reserve = r"עתודה לפיצויים"
            vacation_reserve = r"עתודה לחופש"
            convalescence_reserve = r"עתודה להבראה"
            employer_cost = r"עלות מעסיק"

            national_insurance_exemption_foreign = r"פטור ב.ל. ת.חוץ"
            organization_tax = r"מס אירגון"
            advance_payment = r"מקדמה"

            hours_quantity = r"כמות שעות"
            days_quantity = r"כמות ימים"

        class Center:
            employee_id_shiklulit = r"מספר עובד(שקלולית )"
            id_number = r"מס' ת.זהות"
            employee_name = r"שם העובד"
            department = r"מחלקה"
            position_percentage = r"אחוז משרה"
            employment_start_date = r"תחילת עבודה"
            employment_end_date = r"סיום העסקה"
            annual_vacation_accrual = r"צבירת חופשה שנתית"
            annual_vacation_accrual_limit = r"מגבלת צבירת חופשה שנתית"
            paid_work_days = r"ימי עבודה לתשלום"
            paid_work_hours = r"שעות עבודה משולמות"
            actual_work_days = r"ימי עבודה בפועל"
            actual_work_hours = r"שעות עבודה בפועל"

            total_salary = r"סהכ_ברוטו_קלט"

            base_salary = r"שכר יסוד"
            global_overtime = r"שעות נוספות גלובליות"
            car_or_travel_allowance = r"אחזקת רכב/נסיעות"
            bonus = r"בונוס"
            quarterly_bonus_for_social = r"בונוס רבעוני לסוציאליות"
            quarterly_commission = r"עמלה רבעונית"

            reserve_days_adjustments = r"ימי מילואים בגין הפרשי מילואים"
            reserve_days_during_workdays = r"ימי מילואים במקביל לימי עבודה"
            reserve_adjustments = r"הפרשי מילואים"

            vacation_usage = r"ניצול חופשה"
            vacation_date = r"תאריך חופשה"

            sick_usage = r"ניצול מחלה"
            sick_date = r"תאריך מחלה"

            reserve_days = r"מילואים"
            reserve_date = r"תאריך מילואים"

            holidays = r"חגים"
            meal_value = r"שווי ארוחות"
            gift_value = r"שווי מתנות"

            local_expense_reimbursement = r"החזר הוצאות בארץ"
            expense_charge = r"חיוב הוצאות"
            abroad_expense_reimbursement = r'החזר הוצאות חו"ל'

            pension_or_managers_insurance = r"ביטוח מנהלים או פנסיה"
            study_fund_exists = r'קה"ל - האם קיימת'
            study_fund_tax_ceiling_deposit = r"הפקדה לקרן השתלמות עד לתקרת מס הכנסה ?"

            sick_payment_policy = r"מחלה - תשלום מיום ראשון או לפי חוק"
            section_14_signed = r"חתום סעיף 14"
            controlling_shareholder = r"בעל שליטה- מעל 10%"

            misc_notes = r"שונות/הערות"

            employee_id = r'מספר עובד'
            work_year = r"שנת עבודה"
            work_month = r"חודש עבודה"

    class SocialAnalysisFile:
        year = r"שנת עבודה"
        month = r"חודש עבודה"
        worker_id = r"מספר עובד"
        worker_name = r"שם עובד"
        total_sum = r"רכיבים_סהכ_רכיבים_לסוציאליות"
        ee_prov_sum = r'קופות_סה"כ גמל עובד'
        er_prov_sum = r'קופות_סה"כ גמל מעסיק'
        er_sev_sum = r'קופות_סה"כ פיצויים'
        ee_edu_sum = r'קופות_סה"כ קה"ל עובד'
        er_edu_sum = r'קופות_סה"כ קה"ל מעסיק'
        ee_prov_pct = r"גמל עובד %"
        er_prov_pct = r"גמל מעסיק %"
        capped_val = r"בסיס קהל נגזר"

    class MonthsComparison:
        work_year = r"שנת עבודה"
        work_month = r"חודש עבודה"
        employee_id = r"מספר עובד"
        employee_name = r"שם עובד"
        line_item = r"רכיב"
        months_total = r"סיכום חודשים"
        category = r"סיווג"
        check = r"בדיקה"
        current_month = r"נוכחי"
        previous_month = r"קודם"
        offset = r"סטייה"
        offset_ratio = r"יחס סטייה"
        offset_pct = r"אחוז סטייה"
        notes = r"הערות"
    
    class ReportsAgainstCenter:
        employee_id = r"מספר עובד"
        employee_name = r"שם עובד"
        month = r"חודש"
        check = r"בדיקה"
        center_input = r"קלט (מרכז שכר)"
        external_reports_output = r"פלט (דוחות חיצוניים)"
        offset = r"הפרש"
        offset_pct = r"אחוז הפרש"
        status = r"סטטוס"

    class AggregatedFiles:
        class ProvidentsAGG:
            employee_month_key = r'מפתח_עובד_חודש'
            work_month = r'חודש עבודה'
            employee_id = r'מספר עובד'

            employee_pension_total = r'קופות_סה"כ גמל עובד'
            employer_pension_total = r'קופות_סה"כ גמל מעסיק'
            severance_total = r'קופות_סה"כ פיצויים'

            employee_study_fund_total = r'קופות_סה"כ קה"ל עובד'
            employer_study_fund_total = r'קופות_סה"כ קה"ל מעסיק'

            employee_disability_total = r'קופות_סה"כ אכ"ע עובד'
            employer_disability_total = r'קופות_סה"כ אכ"ע מעסיק'

            total_study_fund_base = r"סה\"כ בסיס קה\"ל"
        
        class AbsencesAGG:
            employee_month_key = r'מפתח_עובד_חודש'
            work_year = r'שנת עבודה'
            work_month = r'חודש עבודה'
            employee_id = r'מספר עובד'

            # Vacation
            vacation_previous_balance = r'חופשה_יתרה_קודמת'
            vacation_monthly_accrual = r'חופשה_צבירה_חודשית'
            vacation_monthly_usage = r'חופשה_ניצול_חודשי'
            vacation_monthly_balance = r'חופשה_יתרה_חודשית'

            # Sick leave
            sick_previous_balance = r'מחלה_יתרה_קודמת'
            sick_monthly_accrual = r'מחלה_צבירה_חודשית'
            sick_monthly_usage = r'מחלה_ניצול_חודשי'
            sick_monthly_balance = r'מחלה_יתרה_חודשית'

        class IncomeAGG:
            employee_month_key = r'מפתח_עובד_חודש'
            work_year = r'שנת עבודה'
            work_month = r'חודש עבודה'
            employee_id = r'מספר עובד'

            total = r'סהכ_זקיפות'

class Masks:
    class SocialAnalaysisComponentsMask:
        base_salary = r'שכר יסוד'
        global_overtime = r'שעות נוספות גלובליות'
        quarterly_bonus_social = r'בונוס רבעוני לסוציאליות'
        early_notice_payment_taxable = r'חלף הודעה מוקדמת חייב'
        quarterly_commission_social = r'עמלה רבעונית לסוציאליות'
        base_salary_rate_2 = r'שכר יסוד תעריף 2'
        global_overtime_rate_2 = r'ש.נ גלובליות תעריף 2'
        hourly_holidays = r'חגים שעתי'

        mask = [
            base_salary,
            global_overtime,
            quarterly_bonus_social,
            early_notice_payment_taxable,
            quarterly_commission_social,
            base_salary_rate_2,
            global_overtime_rate_2,
            hourly_holidays
        ]
    
    class MealsAndGiftsIncomeMask:
        meals_value = r"שווי ארוחות"
        gifts_value = r"שווי מתנות מגולם"

        mask = [
            meals_value,
            gifts_value
        ]

    class TotalSalaryCenterMask:
        # Stable axiology keys (resolved to CONCAT codes at runtime via
        # Axiology.codes(...)) — the components that sum into the center's
        # total-salary column. No hardcoded codes live here anymore.
        keys = [
            "base_salary",
            "global_overtime",
            "travel",
            "bonus",
            "quarterly_bonus_for_social",
            "quarterly_commission_for_socials",
            "reserve_service_differentials",
        ]

