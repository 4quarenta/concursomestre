<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

// api/utils/GoogleAuthenticator.php
// Minimalistic implementation of Google Authenticator TOTP logic

class GoogleAuthenticator {
    protected $_codeLength = 6;

    /**
     * Create new secret.
     * 16 characters, re-uses base32 alphabet.
     *
     * @param int $secretLength
     * @return string
     */
    public function createSecret($secretLength = 16) {
        $validChars = $this->_getBase32LookupTable();
        unset($validChars[32]); // Remove padding character '='
        
        $secret = '';
        $validCharsCount = count($validChars);
        for ($i = 0; $i < $secretLength; $i++) {
            $secret .= $validChars[random_int(0, $validCharsCount - 1)];
        }
        return $secret;
    }

    /**
     * Calculate the code, with given secret and point in time.
     *
     * @param string $secret
     * @param int|null $timeSlice
     * @return string
     */
    public function getCode($secret, $timeSlice = null) {
        if ($timeSlice === null) {
            $timeSlice = floor(time() / 30);
        }

        $secretkey = $this->_base32Decode($secret);

        // Pack time into binary string
        $time = chr(0).chr(0).chr(0).chr(0).pack('N*', $timeSlice);
        // Hash it with users secret key
        $hm = hash_hmac('SHA1', $time, $secretkey, true);
        // Use last snippet of flags to determine offset
        $offset = ord(substr($hm, -1)) & 0x0F;
        // Take 4 bytes from hash, starting at offset
        $hashpart = substr($hm, $offset, 4);

        // Unpack binary value
        $value = unpack('N', $hashpart);
        $value = $value[1];
        // Only 31 bits
        $value = $value & 0x7FFFFFFF;

        $modulo = pow(10, $this->_codeLength);
        return str_pad($value % $modulo, $this->_codeLength, '0', STR_PAD_LEFT);
    }

    /**
     * Get QR-Code URL for image, depracated as Google Charts is discontinued, 
     * but still useful for building URI for client apps.
     *
     * @param string $name
     * @param string $secret
     * @param string $title
     * @param array $params
     * @return string
     */
    public function getQRCodeGoogleUrl($name, $secret, $title = null, $params = array()) {
        $width = !empty($params['width']) ? (int)$params['width'] : 200;
        $height = !empty($params['height']) ? (int)$params['height'] : 200;
        $level = !empty($params['level']) ? $params['level'] : 'M';

        $otpauth = 'otpauth://totp/' . rawurlencode($name) . '?secret=' . $secret;
        if (isset($title)) {
            $otpauth .= '&issuer=' . rawurlencode($title);
        }

        return 'https://api.qrserver.com/v1/create-qr-code/?data=' . urlencode($otpauth) . '&size=' . $width . 'x' . $height . '&ecc=' . $level;
    }

    /**
     * Check if the code is correct. This will accept codes from $discrepancy*30sec around $timeSlice.
     *
     * @param string $secret
     * @param string $code
     * @param int $discrepancy This is the allowed time drift in 30 second units (8 means 4 minutes before or after)
     * @param int|null $currentTimeSlice time slice if we want use other then current
     * @return bool
     */
    public function verifyCode($secret, $code, $discrepancy = 1, $currentTimeSlice = null) {
        if ($currentTimeSlice === null) {
            $currentTimeSlice = floor(time() / 30);
        }

        if (strlen($code) != 6) {
            return false;
        }

        for ($i = -$discrepancy; $i <= $discrepancy; $i++) {
            $calculatedCode = $this->getCode($secret, $currentTimeSlice + $i);
            if ($this->timingSafeEquals($calculatedCode, $code)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array
     */
    protected function _getBase32LookupTable() {
        return array(
            'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', //  7
            'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', // 15
            'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', // 23
            'Y', 'Z', '2', '3', '4', '5', '6', '7', // 31
            '='  // padding char
        );
    }

    /**
     * Helper class to decode base32.
     *
     * @param $secret
     * @return bool|string
     */
    protected function _base32Decode($secret) {
        if (empty($secret)) {
            return '';
        }

        $base32chars = $this->_getBase32LookupTable();
        $base32charsFlipped = array_flip($base32chars);

        $paddingCharCount = substr_count($secret, $base32chars[32]);
        $allowedValues = array(6, 4, 3, 1, 0);
        if (!in_array($paddingCharCount, $allowedValues)) {
            return false;
        }
        for ($i = 0; $i < 4; $i++) {
            if ($paddingCharCount == $allowedValues[$i] &&
                substr($secret, -($allowedValues[$i])) != str_repeat($base32chars[32], $allowedValues[$i])) {
                return false;
            }
        }
        $secret = str_replace('=', '', $secret);
        $secret = str_split($secret);
        $binaryString = '';
        for ($i = 0; $i < count($secret); $i = $i + 8) {
            $x = '';
            if (!in_array($secret[$i], $base32chars)) {
                return false;
            }
            for ($j = 0; $j < 8; $j++) {
                $x .= str_pad(base_convert($base32charsFlipped[$secret[$i + $j]], 10, 2), 5, '0', STR_PAD_LEFT);
            }
            $eightBits = str_split($x, 8);
            for ($z = 0; $z < count($eightBits); $z++) {
                $binaryString .= (($y = chr(base_convert($eightBits[$z], 2, 10))) || ord($y) == 48) ? $y : '';
            }
        }

        return $binaryString;
    }

    /**
     * A timing safe equals comparison
     *
     * @param string $safeString The internal (safe) value to be checked
     * @param string $userString The user-submitted (unsafe) value
     *
     * @return bool True if the two strings are identical.
     */
    private function timingSafeEquals($safeString, $userString) {
        if (function_exists('hash_equals')) {
            return hash_equals($safeString, $userString);
        }
        $safeLen = strlen($safeString);
        $userLen = strlen($userString);

        if ($userLen != $safeLen) {
            return false;
        }

        $result = 0;

        for ($i = 0; $i < $userLen; $i++) {
            $result |= (ord($safeString[$i]) ^ ord($userString[$i]));
        }

        return $result === 0;
    }
}
