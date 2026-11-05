package io.github.leehj825.nexus;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.MobileAds;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Nexus runs as the plain web game inside a full-screen WebView. The game files are bundled in the APK under assets/www
 * and served from a made-up https origin, so the page runs in a secure context (as it would on a web host) without
 * needing file:// access.
 *
 * Debug builds open the page with ?debug (the frame-rate, draw-call and memory overlay) and allow chrome://inspect,
 * so the game can be measured on a real phone.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private static final String TAG = "Nexus";
    // The banner ad unit. Debug builds use Google's test unit, so development never serves or clicks real ads.
    private static final String BANNER_UNIT = "ca-app-pub-4400173019354346/3926241407";
    private static final String TEST_BANNER_UNIT = "ca-app-pub-3940256099942544/6300978111";

    private AdView banner;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("js", "application/javascript");
        MIME.put("css", "text/css");
        MIME.put("json", "application/json");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
        MIME.put("ico", "image/x-icon");
        MIME.put("txt", "text/plain");
    }

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // The banner sits in its own strip at the top, centred; the game is the WebView below it, so the ad never covers the game
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(0xFF000000);

        MobileAds.initialize(this, status -> { });
        banner = new AdView(this);
        banner.setAdUnitId(BuildConfig.DEBUG ? TEST_BANNER_UNIT : BANNER_UNIT);
        banner.setAdSize(AdSize.BANNER);
        LinearLayout.LayoutParams bannerParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        bannerParams.gravity = Gravity.CENTER_HORIZONTAL;
        root.addView(banner, bannerParams);

        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        banner.loadAd(new AdRequest.Builder().build());
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                          // the game keeps its settings in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);

        web.setBackgroundColor(0xFF000000);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!HOST.equals(request.getUrl().getHost())) return null;
                String path = request.getUrl().getPath();
                if (path == null || path.equals("/")) path = "/www/index.html";
                if (path.contains("..")) return null;
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    return new WebResourceResponse(mimeOf(path), "utf-8", in);
                } catch (IOException e) {
                    Log.w(TAG, "Missing asset " + path);
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, m.sourceId() + ":" + m.lineNumber() + " " + m.message());
                return true;
            }
        });

        web.loadUrl(BASE + "www/index.html" + (BuildConfig.DEBUG ? "?debug" : ""));
    }

    private static String mimeOf(String path) {
        int dot = path.lastIndexOf('.');
        String ext = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
        String m = MIME.get(ext);
        return m != null ? m : "application/octet-stream";
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {                                        // immersive: no status or navigation bars
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.nexusSuspend && window.nexusSuspend()", null);     // silence the music at once; the WebView alone leaves Web Audio playing
        if (banner != null) banner.pause();
        web.onPause();                                         // stops the page's timers and rendering while the app is in the background
        super.onPause();
    }

    @Override
    protected void onStop() {
        web.evaluateJavascript("window.nexusSuspend && window.nexusSuspend()", null);
        super.onStop();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (banner != null) banner.resume();
        web.onResume();
        web.evaluateJavascript("window.nexusResume && window.nexusResume()", null);
    }

    @Override
    protected void onDestroy() {
        if (banner != null) banner.destroy();
        web.destroy();
        super.onDestroy();
    }
}
