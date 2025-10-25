from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.test import override_settings
import time


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
        self.assertIn("token", resp.data)

        # Use token to confirm user exists in users list
        token = resp.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
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

    def test_use_action_consumes_and_blocks(self):
        # Login first
        resp = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
        )
        token = resp.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        # First use should succeed
        resp_use = self.client.post("/api/auth/use_action/")
        self.assertEqual(resp_use.status_code, status.HTTP_200_OK)

        # Immediate second use should fail
        resp_use2 = self.client.post("/api/auth/use_action/")
        self.assertEqual(resp_use2.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(ACTION_TICK_SECONDS=1)
    def test_action_refills_after_tick(self):
        # Use a short tick so test can wait briefly
        resp = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
        )
        token = resp.data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")

        # consume
        resp_use = self.client.post("/api/auth/use_action/")
        self.assertEqual(resp_use.status_code, status.HTTP_200_OK)

        # Immediately blocked
        resp_use2 = self.client.post("/api/auth/use_action/")
        self.assertEqual(resp_use2.status_code, status.HTTP_400_BAD_REQUEST)

        # wait for tick to elapse
        time.sleep(1.1)

        # Should be allowed again
        resp_use3 = self.client.post("/api/auth/use_action/")
        self.assertEqual(resp_use3.status_code, status.HTTP_200_OK)
