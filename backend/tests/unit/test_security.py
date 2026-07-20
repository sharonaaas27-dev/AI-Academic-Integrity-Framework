"""Tests for security utilities."""

import pytest
from uuid import uuid4
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    decode_token,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        password = "SecureP@ss123!"
        hashed = hash_password(password)
        assert hashed != password
        assert verify_password(password, hashed)

    def test_verify_wrong_password(self):
        hashed = hash_password("correct_password")
        assert not verify_password("wrong_password", hashed)

    def test_hash_unique(self):
        p1 = hash_password("same_password")
        p2 = hash_password("same_password")
        assert p1 != p2  # Different salts


class TestJWTToken:
    def test_create_and_verify_access_token(self):
        user_id = uuid4()
        institution_id = uuid4()
        session_id = uuid4()

        token = create_access_token(
            subject=user_id,
            role="student",
            institution_id=institution_id,
            session_id=session_id,
        )
        assert token

        payload = verify_token(token, expected_type="access")
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["role"] == "student"
        assert payload["type"] == "access"

    def test_create_and_verify_refresh_token(self):
        user_id = uuid4()
        session_id = uuid4()

        token = create_refresh_token(
            subject=user_id,
            session_id=session_id,
        )
        assert token

        payload = verify_token(token, expected_type="refresh")
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"

    def test_expired_token(self):
        user_id = uuid4()
        from datetime import timedelta

        token = create_access_token(
            subject=user_id,
            role="student",
            institution_id=uuid4(),
            session_id=uuid4(),
            expires_delta=timedelta(seconds=-1),  # Expired
        )

        payload = verify_token(token)
        assert payload is None

    def test_invalid_token(self):
        payload = verify_token("invalid.token.here")
        assert payload is None
