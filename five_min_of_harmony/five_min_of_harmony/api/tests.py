from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status


class AuthApiTests(TestCase):
    def setUp(self):
        self.User = get_user_model()
        self.username = "testuser"
        self.password = "pass123"
        self.email = "test@example.com"
        # ensure no leftover user
        self.User.objects.filter(username=self.username).delete()
        self.user = self.User.objects.create_user(
            username=self.username, email=self.email, password=self.password
        )
        self.client = APIClient()

    def test_login_and_get_users_with_token(self):
        # Login
        resp = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("token", resp.data)
        token = resp.data["token"]

        # Use token to GET users
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        resp2 = self.client.get("/api/auth/users/")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        # Expect at least one user matching the username
        usernames = [u.get("username") for u in resp2.data]
        self.assertIn(self.username, usernames)

    def test_login_bad_credentials(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", resp.data)
