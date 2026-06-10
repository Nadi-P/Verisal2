"""
Files — process-wide singleton holding loaded report state.

Today this is still a flat collection of raw DataFrames and shared metadata
(legacy shape). The plan is to migrate each slot to a Report-instance held
under a bare attribute (`Files.center`, `Files.components`, …), with all
per-report metadata living on the instance.

Constants previously declared here (KEYWORDS, DISPLAY_NAMES) now live in
Constants.py.
"""


class Files:
    current_month = None
    current_year = None
    company_name = None
    min_month = None
    min_year = None
    max_month = None
    max_year = None

    centerDF = None
    center_df_coded = None
    costingDF = None
    incomeDF = None
    absencesDF = None
    deductionsDF = None
    providentsDF = None
    componentsDF = None
    socialAnalysisDF = None
    reportsAgainstCenterDF = None
    monthsComparisonDF = None

    monthsComparisonCheckupColumns = None
    socialAnalysisCheckupColumns = None
    reportsAgainstCenterCheckupColumns = None
