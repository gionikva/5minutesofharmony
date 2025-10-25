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
        # Login (should set a session cookie)
        resp = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Response returns user info (no token when using cookie/session auth)
        self.assertIn("username", resp.data)

        # The test client stores cookies from responses; use the same client to GET users
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

    def test_register_user(self):
        # Ensure registration of a new user succeeds and returns a token
        new_username = "newuser"
        new_password = "newpass123"
        # remove if exists
        self.User.objects.filter(username=new_username).delete()

        resp = self.client.post(
            "/api/auth/register/",
            {
                "username": new_username,
                "password": new_password,
                "email": "n@example.com",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # Response returns user info (session cookie set)
        self.assertIn("username", resp.data)

        # Use same client (with session cookie) to confirm user exists in users list
        resp2 = self.client.get("/api/auth/users/")
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        usernames = [u.get("username") for u in resp2.data]
        self.assertIn(new_username, usernames)

    def test_register_duplicate_username(self):
        # Attempt to register with an existing username should fail
        resp = self.client.post(
            "/api/auth/register/",
            {"username": self.username, "password": "whatever"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", resp.data)
