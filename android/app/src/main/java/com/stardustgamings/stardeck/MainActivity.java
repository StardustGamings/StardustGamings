package com.stardustgamings.stardeck;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.io.IOException;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // No bridge means no WebView on this device; Capacitor shows its own message then.
        if (bridge != null) bridge.setWebViewClient(new PageClient(bridge));
    }

    /**
     * Stardeck is a static site with one HTML file per page (projects/index.html,
     * editor/index.html, …). Capacitor's built-in server answers every page URL with
     * the home page, which is right for single-page apps but would show Home after
     * any full page load, so page URLs are mapped to their own index.html here.
     */
    private class PageClient extends BridgeWebViewClient {

        private final Bridge app;

        PageClient(Bridge bridge) {
            super(bridge);
            this.app = bridge;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            WebResourceResponse page = pageFor(request.getUrl(), request.getMethod());
            return page != null ? page : super.shouldInterceptRequest(view, request);
        }

        private WebResourceResponse pageFor(Uri url, String method) {
            String path = url.getPath();
            String last = url.getLastPathSegment();
            if (
                !"GET".equals(method) ||
                !app.getHost().equals(url.getHost()) ||
                path == null ||
                path.equals("/") ||
                path.contains("..") ||
                (last != null && last.contains("."))
            ) {
                return null;
            }
            String asset = "public" + (path.endsWith("/") ? path : path + "/") + "index.html";
            try {
                InputStream html = MainActivity.this.getAssets().open(asset);
                return new WebResourceResponse("text/html", "utf-8", app.getLocalServer().getJavaScriptInjectedStream(html));
            } catch (IOException missing) {
                // Not a page: let Capacitor answer as usual.
                return null;
            }
        }
    }
}
