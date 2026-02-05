from dateutil.relativedelta import relativedelta


def calculate_fraction_date(start_date, years, months, days, numerator, denominator):
    """
    Calculate the date when a fraction of the sentence is completed.

    Romanian penal system rule:
    - Fractions are calculated based on years and months, not total days
    - Example: Start 01.01.2026, Sentence 1 year, Fraction 1/2
      → 1/2 of 1 year = 6 months
      → Add 6 months to 01.01.2026 = 01.07.2026

    Args:
        start_date: The start date of the sentence
        years: Sentence duration in years
        months: Sentence duration in months
        days: Sentence duration in days
        numerator: Fraction numerator (e.g., 1 for 1/3)
        denominator: Fraction denominator (e.g., 3 for 1/3)

    Returns:
        The calculated date when the fraction is completed
    """
    # Convert years and months to total months
    total_months = years * 12 + months

    # Calculate fraction of months using integer arithmetic
    fraction_months_numerator = total_months * numerator
    fraction_months = fraction_months_numerator // denominator
    month_remainder = fraction_months_numerator % denominator

    # Convert month remainder to days (30 days per month)
    extra_days_from_months = (month_remainder * 30) // denominator

    # Calculate fraction of days
    fraction_days = (days * numerator) // denominator

    # Total fractioned days
    total_fraction_days = fraction_days + extra_days_from_months

    # Convert fraction_months to years and remaining months
    fraction_years = fraction_months // 12
    remaining_months = fraction_months % 12

    # Handle overflow: if days >= 30, convert to months
    if total_fraction_days >= 30:
        additional_months = total_fraction_days // 30
        total_fraction_days = total_fraction_days % 30
        remaining_months += additional_months

        # Handle month overflow
        if remaining_months >= 12:
            fraction_years += remaining_months // 12
            remaining_months = remaining_months % 12

    # Use relativedelta for accurate date arithmetic
    return start_date + relativedelta(
        years=fraction_years,
        months=remaining_months,
        days=total_fraction_days
    )


def calculate_end_date(start_date, years, months, days):
    """
    Calculate the end date of a sentence.

    Romanian penal system rule:
    - If the sentence has only years and/or months (no days), subtract 1 day from end date
    - Example: Start 31.12.2025 + 1 year = 31.12.2026 - 1 day = 30.12.2026
    - If the sentence includes days, the rule does not apply

    Args:
        start_date: The start date of the sentence
        years: Sentence duration in years
        months: Sentence duration in months
        days: Sentence duration in days

    Returns:
        The calculated end date
    """
    end_date = start_date + relativedelta(years=years, months=months, days=days)

    # Apply the minus-one-day rule only when sentence has no days component
    if days == 0 and (years > 0 or months > 0):
        end_date = end_date - relativedelta(days=1)

    return end_date


def calculate_total_days(years, months, days):
    """
    Calculate total days using standard approximations.

    Args:
        years: Sentence duration in years
        months: Sentence duration in months
        days: Sentence duration in days

    Returns:
        Total days as an integer
    """
    return (years * 365) + (months * 30) + days


# Romanian penal system fractions
FRACTION_TYPES = [
    {
        'type': '1/3',
        'numerator': 1,
        'denominator': 3,
        'description': 'Liberare condiționată - infracțiuni normale',
    },
    {
        'type': '1/2',
        'numerator': 1,
        'denominator': 2,
        'description': 'Schimbarea regimului de executare',
    },
    {
        'type': '2/3',
        'numerator': 2,
        'denominator': 3,
        'description': 'Liberare condiționată - infracțiuni grave',
    },
]

# Serious crimes that require 2/3 fraction for conditional release
SERIOUS_CRIMES = [
    'omor',
    'omor_calificat',
    'viol',
    'trafic_persoane',
    'trafic_droguri',
    'terorism',
]
