from django.urls import path
from .views import login_view, users_list

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("users/", users_list, name="api_users"),
]
