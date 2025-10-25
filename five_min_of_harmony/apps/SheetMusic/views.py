from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import SheetMusic
from .constants import *
from .utils import * 
# Create your views here.


@api_view(['PATCH'])
def change_note(request):
    cookie = request.data.get('cookie')
    note_id = request.data.get('note_id')

    valid_change = validate_change(request)
    if valid_change[0] == False :
        return Response({"error": valid_change[1]}, status=status.HTTP_400_BAD_REQUEST)
    
    

    sheet = SheetMusic.objects.get(pk=note_id)
    sheet.pitch = request.data.get('pitch')
    sheet.flourish = request.data.get('flourish')
    return Response({"success": True}, status=status.HTTP_200_OK)