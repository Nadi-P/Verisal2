class Headers:
    class InputFiles:
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

        class Providents:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            employee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"

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

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"

        class Components:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            emloyee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"
            clean_month = r"חודש עבודה נקי"
            

            component_id = r"קוד רכיב"
            component_name = r"שם רכיב"

            tarriff = r"תעריף"
            quantity = r"כמות"
            total_amount = r'סה"כ'
            social_total = r'סהכ_רכיבים_לסוציאליות'

            fixed_value = r"ה. קבע"

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"
        
        class Deductions:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            employee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"

            component_code = r"קוד רכיב"
            component_name = r"שם רכיב"

            rate = r"תעריף"
            quantity = r"כמות"
            total_sum = r'סה"כ'

            fixed_component = r"ה. קבע"

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"
        
        class Income:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            employee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"

            component_code = r"קוד רכיב"
            component_name = r"שם רכיב"

            rate = r"תעריף"
            quantity = r"כמות"
            total = r'סה"כ'

            fixed_component = r"ה. קבע"

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"

        class Absences:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            employee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"
            clean_month = r"חודש_נקי"


            month = r"חודש"

            vacation_code = r"קוד חופש"
            vacation_name = r"שם חופש"

            vacation_opening_balance = r"חופש - יתרת פתיחה"
            vacation_one_time_input = r"חופש - קליטה חד פעמית"
            vacation_previous_balance = r"חופש - יתרה קודמת"
            vacation_last_balance = r"חופש - יתרה אחרונה"
            vacation_monthly_accrual = r"חופש - צבירה חודשית"
            vacation_monthly_usage = r"חופש - ניצול חודשי"
            vacation_monthly_balance = r"חופש - יתרה חודשית"

            sick_code = r"קוד מחלה"
            sick_name = r"שם מחלה"

            sick_opening_balance = r"מחלה - יתרת פתיחה"
            sick_one_time_input = r"מחלה - קליטה חד פעמית"
            sick_previous_balance = r"מחלה - יתרה קודמת"
            sick_last_balance = r"מחלה - יתרה אחרונה"
            sick_monthly_accrual = r"מחלה - צבירה חודשית"
            sick_monthly_usage = r"מחלה - ניצול חודשי"
            sick_monthly_balance = r"מחלה - יתרה חודשית"

            convalescence_code = r"קוד הבראה"
            convalescence_name = r"שם הבראה"

            convalescence_opening_balance = r"הבראה - יתרת פתיחה"
            convalescence_one_time_input = r"הבראה - קליטה חד פעמית"
            convalescence_previous_balance = r"הבראה - יתרה קודמת"
            convalescence_last_balance = r"הבראה - יתרה אחרונה"
            convalescence_monthly_accrual = r"הבראה - צבירה חודשית"
            convalescence_monthly_usage = r"הבראה - ניצול חודשי"
            convalescence_monthly_balance = r"הבראה - יתרה חודשית"

            reserve_monthly_usage = r"מילואים - ניצול חודשי"

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"

        class Costing:
            work_year = r"שנת עבודה"
            employee_id = r"מספר עובד"
            employee_name = r"שם עובד"
            department_name = r"שם מחלקה"
            work_month = r"חודש עבודה"

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

            quarter = r"רבעון"
            half_year = r"חצי שנה"

            sub_department_name = r"שם תת מחלקה"
            id_number = r"מספר זהות"
            company_name = r"שם חברה"
            clean_month = r"חודש_נקי"

    class SocialAnalysis:
        class CenterMask:
            base_salary = r"שכר יסוד"
            global_overtime = r"שעות נוספות גלובליות"
            quarterly_bonus_for_social = r"בונוס רבעוני לסוציאליות"
            car_or_travel_allowance = r"אחזקת רכב/נסיעות"
            quarterly_commission = r"עמלה רבעונית לסוציאליות"
            reserve_adjustments = r"הפרשי מילואים"

        class ComponentsMask:
            base_salary = r'שכר יסוד'
            global_overtime = r'שעות נוספות גלובליות'
            quarterly_bonus_social = r'בונוס רבעוני לסוציאליות'
            early_notice_payment_taxable = r'חלף הודעה מוקדמת חייב'
            quarterly_commission_social = r'עמלה רבעונית לסוציאליות'
            base_salary_rate_2 = r'שכר יסוד תעריף 2'
            global_overtime_rate_2 = r'ש.נ גלובליות תעריף 2'
            hourly_holidays = r'חגים שעתי'

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


