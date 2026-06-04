"""
MediaMTX RTSP/WebRTC server management service.
Adds and removes stream paths via the MediaMTX REST API.
"""

import httpx
import logging

from config import settings

logger = logging.getLogger(__name__)

class MediaMTXService:
    def __init__(self):
        # Default MediaMTX API URL
        self.api_url = settings.MEDIAMTX_API_URL

    async def add_path(self, path_name: str, source_url: str) -> bool:
        """
        Thêm một path vào MediaMTX để kéo luồng từ source_url (RTSP Camera)
        khi có client yêu cầu (sourceOnDemand=True).
        """
        url = f"{self.api_url}/v3/config/paths/add/{path_name}"
        payload = {
            "source": source_url,
            "sourceOnDemand": True,
            "sourceProtocol": "tcp"
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=5.0)
                if response.status_code in [200, 201]:
                    logger.info(f"Đã thêm path '{path_name}' vào MediaMTX thành công.")
                    return True
                else:
                    logger.error(f"Lỗi thêm path '{path_name}' vào MediaMTX. Status: {response.status_code}, Body: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"Exception khi giao tiếp với MediaMTX: {e}")
            return False

    async def remove_path(self, path_name: str) -> bool:
        """
        Xoá path khỏi MediaMTX.
        """
        url = f"{self.api_url}/v3/config/paths/delete/{path_name}"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, timeout=5.0)
                if response.status_code in [200, 204]:
                    logger.info(f"Đã xoá path '{path_name}' khỏi MediaMTX.")
                    return True
                elif response.status_code == 404:
                    logger.warning(f"Path '{path_name}' không tồn tại trên MediaMTX.")
                    return True
                else:
                    logger.error(f"Lỗi xoá path '{path_name}'. Status: {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Exception khi giao tiếp với MediaMTX: {e}")
            return False

# Singleton instance
mediamtx_service = MediaMTXService()
