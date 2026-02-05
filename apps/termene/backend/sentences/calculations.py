from dateutil.relativedelta import relativedelta


def calculate_fraction_date(start_date, years, months, days, numerator, denominator):
    """
    Calculate the date when a fraction of the sentence is completed.

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
    # Calculate total days using standard approximations
    total_days = (years * 365) + (months * 30) + days

    # Calculate fraction of total days
    fraction_days = (total_days * numerator) // denominator

    # Convert back to years, months, days for accurate date calculation
    fraction_years = fraction_days // 365
    remaining = fraction_days % 365
    fraction_months = remaining // 30
    fraction_days_final = remaining % 30

    # Use relativedelta for accurate date arithmetic
    return start_date + relativedelta(
        years=fraction_years,
        months=fraction_months,
        days=fraction_days_final
    )


def calculate_end_date(start_date, years, months, days):
    """
    Calculate the end date of a sentence.

    Args:
        start_date: The start date of the sentence
        years: Sentence duration in years
        months: Sentence duration in months
        days: Sentence duration in days

    Returns:
        The calculated end date
    """
    return start_date + relativedelta(years=years, months=months, days=days)


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
