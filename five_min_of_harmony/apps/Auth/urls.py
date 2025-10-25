from django.urls import path
from .views import login_view, users_list, register_view, my_profile, has_action

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("register/", register_view, name="api_register"),
    path("users/", users_list, name="api_users"),
    path("me/", my_profile, name="api_me"),
    path("has_action/", has_action, name="api_has_action"),
]
