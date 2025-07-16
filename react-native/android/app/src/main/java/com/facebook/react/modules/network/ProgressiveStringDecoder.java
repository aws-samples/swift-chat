//
// Source code recreated from a .class file by IntelliJ IDEA
// (powered by FernFlower decompiler)
//

package com.facebook.react.modules.network;

import android.util.Log;
import com.facebook.common.logging.FLog;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

class ProgressiveStringDecoder {
    private final CharsetDecoder mDecoder;
    public ProgressiveStringDecoder(Charset charset) {
        this.mDecoder = charset.newDecoder();
    }

    public String decodeNext(byte[] data, int length) {
        ByteBuffer decodeBuffer = ByteBuffer.wrap(data, 0, length);
        CharBuffer result;

        try {
            result = mDecoder.decode(decodeBuffer);
        } catch (CharacterCodingException e) {
            // First decoding failed, directly use JSON extraction method
            String extractedJson = extractSimpleJSONFromData(data, length);
            return extractedJson.isEmpty() ? "" : extractedJson;
        }
        if (result != null) {
            return new String(result.array(), 0, result.length());
        } else {
            FLog.w("SwiftChat", "failed to decode string from byte array");
            return "";
        }
    }

    public static String extractSimpleJSONFromData(byte[] data, int length) {
        List<String> jsonStrings = new ArrayList<>();
        int i = 0;
        while (i < length - 1) {
            if (data[i] == '{' && data[i + 1] == '"') {
                int startIndex = i;
                int braceCount = 0;
                boolean inString = false;
                boolean escaped = false;
                int endIndex = -1;

                for (int j = startIndex; j < length; j++) {
                    byte b = data[j];

                    if (escaped) {
                        escaped = false;
                        continue;
                    }

                    if (b == '\\' && inString) {
                        escaped = true;
                        continue;
                    }

                    if (b == '"') {
                        inString = !inString;
                    } else if (!inString) {
                        if (b == '{') {
                            braceCount++;
                        } else if (b == '}') {
                            braceCount--;
                            if (braceCount == 0) {
                                endIndex = j;
                                break;
                            }
                        }
                    }
                }
                if (endIndex >= 0) {
                    try {
                        byte[] jsonData = Arrays.copyOfRange(data, startIndex, endIndex + 1);
                        String jsonString = new String(jsonData, StandardCharsets.UTF_8);
                        jsonStrings.add(jsonString);
                        i = endIndex + 1;
                    } catch (Exception e) {
                        i++;
                    }
                } else {
                    i++;
                }
            } else {
                i++;
            }
        }
        return String.join("\n\n", jsonStrings);
    }

}
