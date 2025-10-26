from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Measure
from .models import Note
from .constants import *
from .utils import * 
from Auth.utils import user_has_action
# Create your views here.


@api_view(['PATCH'])
def change_pitch(request):

    note_id = request.data.get('note_id')

    valid_change = validate_change(request)
    if valid_change[0] == False :
        return Response({"error": valid_change[1]}, status=status.HTTP_400_BAD_REQUEST)
    
    if user_has_action(request.user) == False:
        return Response({"error": "User does not have access to actions."}, status=status.HTTP_400_BAD_REQUEST)

    note = Note.objects.get(pk=note_id)
    note.pitch = request.data.get('pitch')
    return Response({"success": True}, status=status.HTTP_200_OK)


@api_vew(['PATCH'])
def combine_pitch(request):
    note_id = request.data.get('note_id')
    