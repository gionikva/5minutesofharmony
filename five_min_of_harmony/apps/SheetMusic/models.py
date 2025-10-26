from django.db import models
from ordered_model.models import OrderedModel

# Create your models here.

class Measure(models.Model):
    meas_num = models.PositiveIntegerField()


class Note(OrderedModel):
    measure = models.ForeignKey(
        Measure,
        on_delete=models.CASCADE,
        related_name='notes'
    )
    duration = models.PositiveIntegerField()
    pitch = models.CharField()    

    order_with_respect_to = 'measure'

    class Meta(OrderedModel.Meta):
        pass