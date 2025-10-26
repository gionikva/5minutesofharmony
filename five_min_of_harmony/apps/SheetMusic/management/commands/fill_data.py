from django.core.management.base import BaseCommand
from ...models import Measure, Note
from ...constants import *
class Command(BaseCommand):
    help = "Fills the music sheet with non-initialized rests"

    def add_arguments(self, parser):
        # Optional: define command-line arguments
        parser.add_argument('--option', type=str, help='Optional argument')

    def handle(self, *args, **options):
        # Main logic of the command goes here
        self.stdout.write("Clearing all old data...")
        Note.objects.all().delete()
        Measure.objects.all().delete()
        self.stdout.write("Old data gone for a million years...")


        for index in range(TOTAL_MEASURES):
            measure = Measure.objects.create(index=index)
            for n in range(4):
                note = Note.objects.create(pitch="rest",
                                           measure=measure,
                                           duration=4,
                                           initialized=False)
        

        self.stdout.write(self.style.SUCCESS("Command completed successfully!"))
