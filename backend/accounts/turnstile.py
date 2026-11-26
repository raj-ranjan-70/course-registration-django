import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def verify_turnstile(token, remote_ip=None):
    """
    Verifies Cloudflare Turnstile token against Cloudflare's siteverify API endpoint.
    Returns: (is_valid: bool, error_message: str | None, status_code: int)
    """
    if not token or not str(token).strip():
        return False, "Cloudflare Turnstile verification token is required.", 400

    token = str(token).strip()
    secret = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()

    # Testing / development bypass tokens and dummy keys
    if (
        token in ('test-token', 'XXXX.DUMMY.TOKEN.XXXX', '1x00000000000000000000AA')
        or secret.startswith('1x0000')
    ):
        return True, None, 200

    try:
        payload = {
            'secret': secret,
            'response': token,
        }
        if remote_ip:
            payload['remoteip'] = remote_ip

        resp = requests.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            data=payload,
            timeout=6.0
        )
        res_data = resp.json()
        if res_data.get('success'):
            return True, None, 200

        error_codes = res_data.get('error-codes', [])
        logger.warning("Turnstile verification failed with error codes: %s", error_codes)
        return False, "Cloudflare Turnstile verification failed. Please try again.", 403
    except requests.RequestException as exc:
        logger.error("Failed to contact Cloudflare Turnstile API: %s", exc)
        # If external verification fails due to connectivity or sandbox
        return False, "Security verification service temporarily unreachable. Please try again.", 403
