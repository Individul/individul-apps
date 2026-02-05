from django.test import TestCase
from datetime import date
from .calculations import calculate_fraction_date, calculate_end_date, calculate_total_days


class FractionCalculationTests(TestCase):
    def test_calculate_total_days(self):
        """Test total days calculation."""
        # 5 years = 5 * 365 = 1825 days
        self.assertEqual(calculate_total_days(5, 0, 0), 1825)

        # 2 years, 6 months = 2*365 + 6*30 = 910 days
        self.assertEqual(calculate_total_days(2, 6, 0), 910)

        # 1 year, 3 months, 15 days = 365 + 90 + 15 = 470 days
        self.assertEqual(calculate_total_days(1, 3, 15), 470)

    def test_calculate_fraction_date_one_third(self):
        """Test 1/3 fraction calculation."""
        start_date = date(2024, 1, 1)

        # 3 years sentence, 1/3 = 1 year
        result = calculate_fraction_date(start_date, 3, 0, 0, 1, 3)
        expected = date(2024, 12, 31)  # Approximately 1 year later
        self.assertEqual(result, expected)

    def test_calculate_fraction_date_one_half(self):
        """Test 1/2 fraction calculation."""
        start_date = date(2024, 1, 1)

        # 2 years sentence, 1/2 = 1 year
        result = calculate_fraction_date(start_date, 2, 0, 0, 1, 2)
        expected = date(2024, 12, 31)  # Approximately 1 year later
        self.assertEqual(result, expected)

    def test_calculate_fraction_date_two_thirds(self):
        """Test 2/3 fraction calculation."""
        start_date = date(2024, 1, 1)

        # 3 years sentence, 2/3 = 2 years
        result = calculate_fraction_date(start_date, 3, 0, 0, 2, 3)
        expected = date(2025, 12, 31)  # Approximately 2 years later
        self.assertEqual(result, expected)

    def test_calculate_end_date(self):
        """Test end date calculation."""
        start_date = date(2024, 1, 1)

        # 5 years sentence
        result = calculate_end_date(start_date, 5, 0, 0)
        expected = date(2029, 1, 1)
        self.assertEqual(result, expected)

        # 2 years, 6 months sentence
        result = calculate_end_date(start_date, 2, 6, 0)
        expected = date(2026, 7, 1)
        self.assertEqual(result, expected)

    def test_fraction_with_months_and_days(self):
        """Test fraction calculation with months and days."""
        start_date = date(2024, 1, 1)

        # 1 year, 6 months = 18 months = 540 days (approx)
        # 1/3 = 180 days = 6 months
        result = calculate_fraction_date(start_date, 1, 6, 0, 1, 3)
        # Should be approximately 6 months from start
        self.assertTrue(result > start_date)
        self.assertTrue(result < date(2024, 12, 31))
