
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

        id = r" קוד"
        name = r" שם"
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


class PayrollCodes:

    # --- Group 1: Earnings, Benefits, and Allowances ---
    base_salary = 11                             # שכר יסוד
    cost_of_living = 12                          # תוספת יוקר
    travel = 13                                  # נסיעות
    convalescence = 14                           # הבראה
    phone_allowance = 15                         # אחזקת טלפון
    car_allowance = 16                           # אחזקת רכב
    vacation_redemption = 17                     # פדיון חופש
    vacation_pay = 18                            # תמורת חופשה
    early_notice_pay = 19                        # אי הודעה מוקדמת
    retirement_grant = 110                       # מענק פרישה
    death_grant = 111                            # מענק מוות
    severance_pay = 112                          # פיצויי פיטורין
    expense_reimbursement_eshel = 113            # החזר הוצאות אש"ל
    gross_up_periods = 114                       # גילום תקופות
    gross_up_deductions = 115                    # גילום ניכויים
    gross_up_costs = 116                         # גילום עלויות
    index_linkage = 117                          # הצמדה למדד
    dollar_linkage = 118                         # הצמדה לדולר
    gross_up_extra_periods = 119                 # גילום תקופות ת. נוסף
    lecturer_salary = 125                        # שכר מרצים
    vat_lecturers = 126                          # מע"מ מרצים
    vat_self_invoice = 127                       # מע"מ חשבונית עצמית
    global_overtime = 131                        # שעות נוספות גלובליות
    non_compete_compensation = 132               # פיצוי אי תחרות
    additional_monthly_compensation = 133        # פיצוי חודשי נוסף
    global_overtime_125 = 134                    # ש.נ. גלובליות 125%
    global_overtime_150 = 135                    # ש.נ. גלובליות 150%
    overtime_125 = 136                           # שעות נוספות 125%
    overtime_150 = 137                           # שעות נוספות 150%
    base_salary_rate_2 = 138                     # שכר יסוד תעריף 2
    global_overtime_rate_2 = 139                 # ש.נ גלובליות תעריף 2
    car_maintenance_km = 140                     # אחזקת רכב (ק"מ)
    car_maintenance_grossed_up = 141             # אחזקת רכב מגולם
    phone_maintenance = 142                      # אחזקת טלפון
    phone_maintenance_grossed_up = 143           # אחזקת טלפון מגולם
    fixed_expense_reimbursement = 144            # החזר הוצאות קבועות
    medical_insurance_reimbursement = 145        # החזר ביטוח רפואי
    meal_reimbursement = 146                     # החזר ארוחות
    meal_reimbursement_grossed_up = 147          # החזר ארוחות מגולם
    housing_expense_reimbursement = 148          # החזר הוצאות מגורים
    holiday_gift = 149                           # מתנה לחג
    holiday_gift_grossed_up = 150                # מתנה לחג מגולם
    absence_deduction = 151                      # קיזוז היעדרויות
    hourly_sick_pay = 152                        # מחלה שעתי
    hourly_holiday_pay = 153                     # חגים שעתי
    hourly_vacation_pay = 154                    # חופש שעתי
    hourly_reserve_pay = 155                     # מילואים שעתי
    election_day = 156                           # יום בחירות
    vacation_cost = 157                          # חופשה - עלות
    sick_cost = 158                              # מחלה - עלות
    reserve_cost = 159                           # מילואים - עלות
    salary_differentials = 160                   # הפרשי שכר
    reserve_service_benefits = 161               # תגמולי מילואים
    reserve_service_differentials = 162          # הפרשי מילואים
    travel_differentials = 163                   # הפרשי נסיעות
    bonus_differentials = 164                    # הפרשי בונוס
    compensation_instead_of_socials = 165        # פיצוי במקום סוציאליות
    compensation_instead_of_study_fund = 166     # פיצוי במקום קה"ל
    taxable_early_notice = 167                   # חלף הודעה מוקדמת חייב
    exempt_early_notice = 168                    # חלף הודעה מוקדמת פטור
    early_notice_notification = 169              # הודעה מוקדמת
    bonus = 170                                  # בונוס
    referral_bonus = 171                         # בונוס חבר מביא חבר
    social_benefits_bonus = 172                  # בונוס לסוציאליות
    quarterly_commission = 173                   # עמלה רבעונית
    monthly_commission = 174                     # עמלה חודשית
    signing_bonus = 175                          # מענק חתימה
    adjustment_grant = 176                       # מענק הסתגלות
    social_benefits_on_bonus = 177               # סוציאליות בגין בונוס
    hourly_election_day_salary = 178             # שכר שעתי יום בחירות
    global_election_polling_worker = 179         # שכר גלובלי עובדי קלפיות
    election_worker_expense_reimbursement = 180  # החזר הוצאות עובדי בחירות
    car_running_deduction = 181                  # קיזוז רכב רן
    quarterly_commission_for_socials = 182       # עמלה רבעונית לסוציאליות
    quarterly_bonus_for_social = 189             # בונוס רבעוני לסוציאליות

    # --- Group 2: Benefits and Notional Values (Shovi) ---
    shovi_car = 21                               # שווי שימוש ברכב
    shovi_meals = 22                             # שווי ארוחות
    shovi_interest = 23                          # שווי ריבית
    shovi_study_fund = 24                        # שווי קרן השתלמות
    shovi_pension = 26                           # שווי קצבה
    shovi_disability_insurance = 27              # שווי א.כושר
    car_value_differentials = 28                 # הפרשי שווי רכב
    shovi_mobile_phone = 29                      # שווי טלפון נייד
    shovi_severance = 210                        # שווי פיצויים
    shovi_gifts = 221                            # שווי מתנות
    shovi_meals_value = 222                      # שווי ארוחות
    shovi_gifts_grossed_up = 223                 # שווי מתנות מגולם
    shovi_holiday_gift = 224                     # שווי מתנות לחג
    shovi_holiday_gift_grossed_up = 225          # שווי מתנות לחג מגולם
    shovi_gift_correction = 226                  # תיקון שווי מתנות
    shovi_meals_grossed_up = 227                 # שווי ארוחות מגולם
    shovi_meals_correction = 228                 # תיקון שווי ארוחות
    shovi_mobile_phone_grossed_up = 229          # שווי טלפון מגולם
    shovi_health_insurance = 230                 # שווי ביטוח בריאות

    # --- Group 3: Deductions, Loans, and Technical ---
    advance_payment_1 = 31                       # מקדמה
    advance_payment_2 = 32                       # מקדמה 2
    repayment = 33                               # מפרעה
    loan = 34                                    # הלוואה
    linked_loan = 35                             # הלוואה צמודה
    loan_interest = 36                           # ריבית על הלוואה
    vat_on_interest = 37                         # מע"מ על הריבית
    meal_participation = 38                      # השתתפות בארוחות
    vat_on_meals = 39                            # מע"מ על ארוחות
    unpaid_leave_health_insurance = 310          # חל"ת - ד. בריאות
    unpaid_leave_national_insurance = 311        # חל"ת - ד. ביטוח
    negative_net = 313                           # נטו שלילי
    expense_reimbursement = 321                  # החזר הוצאות
    abroad_expense_reimbursement = 322           # החזר הוצאות חו"ל
    expense_reimbursement_charge = 323           # חיוב החזרי הוצאות
    abroad_expense_reimbursement_charge = 324    # חיוב החזר הוצאות חו"ל
    paystub_correction_previous_month = 325      # החזר עקב תיקון תלוש קודם
    phone_reimbursement = 326                    # החזר טלפון
    study_fund_deduction_kahal = 327             # קיזוז קופ"ג חל"ד
    paystub_correction = 328                     # תיקון תלוש שכר
    pension_fund_payment = 329                   # תשלום לקופות גמל
    option_exercise = 330                        # מימוש אופציות
    equipment_purchase_offset = 331              # קיזוז רכישת ציוד
    election_worker_expense_reimbursement_offset = 332 # החזר הוצאות עובדי בחירות

    # --- Group 4: Quantities and Days ---
    vacation_usage = 41                          # ניצול חופשה
    sick_usage = 42                              # ניצול מחלה
    reserve_days = 43                            # ימי מילואים
    paid_work_days = 44                          # ימי עבודה משולמים
    work_hours = 45                              # שעות עבודה
    daily_worker_days = 46                       # ימים רק לעובד יומי
    actual_work_days = 47                        # ימי עבודה בפועל
    paid_work_hours = 48                         # שעות עבודה משולמות

    # --- Group 91: Employer Side / Costs ---
    travel_er = 913                              # נסיעות
    convalescence_er = 914                       # הבראה
    vacation_redemption_er = 917                 # פדיון חופש
    vacation_pay_er = 918                        # תמורת חופשה
    overtime_125_er = 9136                       # שעות נוספות 125%
    overtime_150_er = 9137                       # שעות נוספות 150%
    car_maintenance_km_er = 9140                 # אחזקת רכב (ק"מ)
    absence_deduction_er = 9151                  # קיזוז היעדרויות
    hourly_sick_pay_er = 9152                    # מחלה שעתי
    hourly_holiday_pay_er = 9153                 # חגים שעתי
    hourly_vacation_pay_er = 9154                # חופש שעתי
    hourly_reserve_pay_er = 9155                 # מילואים שעתי
    election_day_er = 9156                       # יום בחירות
    vacation_cost_er = 9157                      # חופשה - עלות
    sick_cost_er = 9158                          # מחלה - עלות
    reserve_cost_er = 9159                       # מילואים - עלות

    employee_id = -1
    id_number = -2
    employee_name = -3
    is_study_fund_exist = -4
    work_year = -5                               # שנת עבודה (synthesized in aggregate_center)
    work_month = -6                              # חודש עבודה (synthesized in aggregate_center)
    total_salary = -7                            # סהכ ברוטו קלט (synthesized in aggregate_center)

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
        base_salary = PayrollCodes.base_salary
        global_overtime = PayrollCodes.global_overtime
        travel = PayrollCodes.travel
        bonus = PayrollCodes.bonus
        quarterly_bonus_for_social = PayrollCodes.quarterly_bonus_for_social
        quarterly_commission_for_socials = PayrollCodes.quarterly_commission_for_socials
        reserve_service_differentials = PayrollCodes.reserve_service_differentials

        mask = [
            base_salary,
            global_overtime,
            travel,
            bonus,
            quarterly_bonus_for_social,
            quarterly_commission_for_socials,
            reserve_service_differentials
        ]

