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

    # valid_change = validate_change(request)
    # if valid_change[0] == False :
    #     return Response({"error": valid_change[1]}, status=status.HTTP_400_BAD_REQUEST)
    
    if user_has_action(request.user) == False:
        return Response({"error": "User does not have access to actions."}, status=status.HTTP_400_BAD_REQUEST)

    note = Note.objects.get(pk=note_id)
    note.pitch = request.data.get('pitch')
    return Response({"success": True}, status=status.HTTP_200_OK)


@api_view(['POST'])
def combine_pitch(request):

    if user_has_action(request.user) == False:
        return Response({"error": "User does not have access to actions."}, status=status.HTTP_400_BAD_REQUEST)

    note_id_list = request.data.get('note_id_list')

    note_list =  []
    note_position = []

    for id in note_id_list:
        note = Note.objects.get(id=id)
        if  not (note == None):
            note_list.append(note)
            note_position.append(note.order)
    
    notes_len = len(note_list)
    if notes_len < 2:
        return Response({"error": "Not enough valid note IDs."}, status=status.HTTP_400_BAD_REQUEST)


    #assuming all note durrations and pitches are the same
    duration = note_list[0].duration
    pitch = note_list[0].pitch
    measure_id = note_list[0].measure_id

    min_pos = min(note_position)

    for note in note_list:
        note.delete()

    combined_note = Note.objects.create(measure=measure_id, 
                                        pitch=pitch,
                                        duration = duration * notes_len,
                                        weak=False)

    combined_note.insert_at(min_pos)
    return Response({"success": True}, status=status.HTTP_200_OK)






