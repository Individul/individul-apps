from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Petition


class PetitionModelTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='operator',
            password='StrongPass123!',
        )

    def create_petition(self, **overrides):
        data = {
            'registration_prefix': 'P',
            'registration_date': timezone.now().date(),
            'petitioner_type': Petition.PetitionerType.CONDAMNAT,
            'petitioner_name': 'Ion Popescu',
            'object_type': Petition.ObjectType.ART_91,
            'created_by': self.user,
        }
        data.update(overrides)
        return Petition.objects.create(**data)

    def test_registration_number_uses_prefix_sequence_and_year(self):
        petition = self.create_petition(
            registration_date=date(2026, 2, 11),
        )
        self.assertEqual(petition.registration_number, 'P-1/26')

    def test_due_soon_is_true_when_deadline_is_within_default_window(self):
        petition = self.create_petition(
            registration_date=timezone.now().date() - timedelta(days=9),
        )
        self.assertTrue(petition.is_due_soon)
        self.assertFalse(petition.is_overdue)

    def test_overdue_is_true_when_deadline_passed(self):
        petition = self.create_petition(
            registration_date=timezone.now().date() - timedelta(days=13),
        )
        self.assertTrue(petition.is_overdue)

    def test_solved_petitions_are_not_due_soon_or_overdue(self):
        petition = self.create_petition(
            registration_date=timezone.now().date() - timedelta(days=30),
            status=Petition.Status.SOLUTIONATA,
        )
        self.assertFalse(petition.is_due_soon)
        self.assertFalse(petition.is_overdue)
