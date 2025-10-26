from django.db import models

# Create your models here.


class NoteArr(models.Model):
    value = models.PositiveIntegerField()
    pitch = models.CharField()
    flourish = models.CharField()
    