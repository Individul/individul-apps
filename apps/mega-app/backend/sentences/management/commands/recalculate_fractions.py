from django.core.management.base import BaseCommand
from sentences.models import Sentence


class Command(BaseCommand):
    help = 'Recalculate fractions for all existing sentences'

    def handle(self, *args, **options):
        sentences = Sentence.objects.all()
        total = sentences.count()

        print(f'Found {total} sentences to recalculate...')

        success_count = 0
        error_count = 0

        for i, sentence in enumerate(sentences, 1):
            try:
                sentence.generate_fractions()
                success_count += 1
                print(f'[{i}/{total}] OK - Sentence ID: {sentence.id}')
            except Exception as e:
                error_count += 1
                print(f'[{i}/{total}] ERROR - Sentence ID: {sentence.id}: {e}')

        print(f'Done! Success: {success_count}, Errors: {error_count}')
