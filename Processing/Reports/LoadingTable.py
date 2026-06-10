from Reports.Report import Report


class LoadingTable(Report):
    def __init__(self, center_df, components_df, providents_df, income_df, deductions_df, costing_df, absences_df):
        super().__init__()
        self.id = "loading_table"
        self.display_label = "טבלת טעינה"
        self.is_input = False
        self.dependencies = ["center", "components", "providents", "income", "deductions", "costing", "absences"]

        self.center_df = center_df
        self.components_df = components_df
        self.providents_df = providents_df
        self.income_df = income_df
        self.deductions_df = deductions_df
        self.costing_df = costing_df
        self.absences_df = absences_df

        self.parse_preset()
