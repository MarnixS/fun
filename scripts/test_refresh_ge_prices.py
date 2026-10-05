import io
import json
import tempfile
import unittest
from pathlib import Path
from refresh_ge_prices import INTERVAL_SECONDS, refresh


class PriceRefreshTests(unittest.TestCase):
    def test_shared_refresh_interval_and_failures(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'prices.json'
            calls = []
            data = {'13263': {'high': 30000000, 'highTime': 900}}

            def wiki(request, timeout):
                calls.append(request)
                self.assertIn('United Gimps', request.get_header('User-agent'))
                return io.BytesIO(json.dumps({'data': data}).encode())

            self.assertTrue(refresh(path, now=1000, opener=wiki))
            before = json.loads(path.read_text())
            self.assertFalse(refresh(path, now=1000 + INTERVAL_SECONDS - 1, opener=wiki))
            self.assertEqual(len(calls), 1)
            self.assertTrue(refresh(path, now=1000 + INTERVAL_SECONDS, opener=wiki))
            self.assertEqual(len(calls), 2)
            self.assertEqual(json.loads(path.read_text())['data'], data)
            failed_at = 1000 + 2 * INTERVAL_SECONDS

            def broken(request, timeout):
                calls.append(request)
                raise OSError('Wiki unavailable')

            with self.assertRaises(OSError):
                refresh(path, now=failed_at, opener=broken)
            after = json.loads(path.read_text())
            self.assertEqual(after['data'], before['data'])
            self.assertEqual(after['fetchedAt'], (1000 + INTERVAL_SECONDS) * 1000)
            self.assertFalse(refresh(path, now=failed_at + 3600, opener=broken))
            self.assertEqual(len(calls), 3, 'failed attempts are also limited to once per 12 hours')

            def invalid(request, timeout):
                return io.BytesIO(b'{"data": {}}')

            with self.assertRaises(ValueError):
                refresh(path, now=failed_at + INTERVAL_SECONDS, opener=invalid)
            self.assertEqual(json.loads(path.read_text())['data'], data)


if __name__ == '__main__':
    unittest.main()
