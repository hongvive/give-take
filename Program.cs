using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

namespace GiveAndTake
{
    internal static class Program
    {
        private static HttpListener _listener;
        private static int _port;
        private static DateTime _lastHeartbeat = DateTime.Now;
        private static DateTime _startTime = DateTime.Now;
        private static string _baseDir;
        private static readonly ManualResetEvent _exitEvent = new ManualResetEvent(false);

        [STAThread]
        private static void Main()
        {
            _baseDir = AppDomain.CurrentDomain.BaseDirectory;
            _startTime = DateTime.Now;
            _lastHeartbeat = DateTime.Now;

            // 1. 고정 포트 19280 우선 바인딩 (동일 Origin 유지로 localStorage 영구 보존)
            bool started = false;
            for (int p = 19280; p <= 19300; p++)
            {
                try
                {
                    _port = p;
                    _listener = new HttpListener();
                    _listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", _port));
                    _listener.Start();
                    started = true;
                    break;
                }
                catch
                {
                    try { _listener.Close(); } catch { }
                }
            }

            if (!started)
            {
                // 차선책: 동적 가용 포트 시도
                for (int attempt = 0; attempt < 5; attempt++)
                {
                    try
                    {
                        _port = FindFreePort();
                        _listener = new HttpListener();
                        _listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", _port));
                        _listener.Start();
                        started = true;
                        break;
                    }
                    catch
                    {
                        Thread.Sleep(100);
                    }
                }
            }

            if (!started)
            {
                return;
            }

            // 2. 비동기 요청 처리 스레드 시작
            ThreadPool.QueueUserWorkItem(ListenLoop);

            // 3. 서버 Warmup Probe (서버 준비 200 OK 확인까지 대기)
            for (int i = 0; i < 30; i++)
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(string.Format("http://127.0.0.1:{0}/index.html", _port));
                    req.Timeout = 500;
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        if (resp.StatusCode == HttpStatusCode.OK) break;
                    }
                }
                catch
                {
                    Thread.Sleep(80);
                }
            }

            // 4. 격리 프로필 및 First Run 센티넬 파일 준비 (환영 팝업 방지)
            string appDataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GiveAndTake", "Profile");
            Directory.CreateDirectory(appDataDir);
            try
            {
                string sentinel = Path.Combine(appDataDir, "First Run");
                if (!File.Exists(sentinel))
                {
                    File.WriteAllText(sentinel, "");
                }
            }
            catch { }

            // 5. 45초 초기 유예 하트비트 감시 워치독 가동
            StartHeartbeatWatchdog(45);

            // 6. 브라우저 앱 모드 실행
            string browserPath = GetBrowserPath();
            string appUrl = string.Format("http://127.0.0.1:{0}/index.html", _port);
            string args = string.Format(
                "--app=\"{0}\" " +
                "--user-data-dir=\"{1}\" " +
                "--no-first-run " +
                "--no-default-browser-check " +
                "--disable-features=Translate,msEdgeWelcomePage,msFirstRunExperience " +
                "--disable-sync " +
                "--disable-component-update " +
                "--disable-extensions " +
                "--disable-background-networking " +
                "--window-size=1400,920",
                appUrl, appDataDir);

            try
            {
                if (File.Exists(browserPath))
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = args,
                        UseShellExecute = false
                    };
                    Process.Start(psi);
                }
                else
                {
                    Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
                }
            }
            catch
            {
                try
                {
                    Process.Start(new ProcessStartInfo(appUrl) { UseShellExecute = true });
                }
                catch { }
            }

            // 7. 중요: browserProc.WaitForExit() 대신 하트비트 기반 종료 대기!
            // Edge는 내부 브로커로 작업을 넘긴 후 런처 프로세스가 즉시 반환되므로 WaitForExit()을 쓰면 서버가 즉각 종료되는 버그가 발생함.
            _exitEvent.WaitOne();

            // 8. 브라우저 창 종료 감지 후 안전 종료
            try { _listener.Stop(); } catch { }
            Environment.Exit(0);
        }

        private static void ListenLoop(object state)
        {
            while (_listener != null && _listener.IsListening)
            {
                try
                {
                    HttpListenerContext ctx = _listener.GetContext();
                    ThreadPool.QueueUserWorkItem(ProcessRequest, ctx);
                }
                catch
                {
                    break;
                }
            }
        }

        private static void ProcessRequest(object state)
        {
            HttpListenerContext ctx = (HttpListenerContext)state;
            try
            {
                string rawUrl = ctx.Request.Url.AbsolutePath.TrimStart('/');
                if (string.IsNullOrEmpty(rawUrl)) rawUrl = "index.html";

                // 1. 하트비트 처리
                if (rawUrl.Equals("api/heartbeat", StringComparison.OrdinalIgnoreCase))
                {
                    _lastHeartbeat = DateTime.Now;
                    byte[] okBytes = System.Text.Encoding.UTF8.GetBytes("{\"status\":\"ok\"}");
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = okBytes.Length;
                    ctx.Response.OutputStream.Write(okBytes, 0, okBytes.Length);
                    ctx.Response.OutputStream.Close();
                    return;
                }

                // 2. 로컬 디스크 파일 영구 저장 API (POST)
                if (rawUrl.Equals("api/save", StringComparison.OrdinalIgnoreCase))
                {
                    string dataDir = Path.Combine(_baseDir, "data");
                    if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);
                    string savePath = Path.Combine(dataDir, "gnt_ledger_store.json");

                    using (StreamReader sr = new StreamReader(ctx.Request.InputStream, System.Text.Encoding.UTF8))
                    {
                        string body = sr.ReadToEnd();
                        if (!string.IsNullOrEmpty(body))
                        {
                            File.WriteAllText(savePath, body, System.Text.Encoding.UTF8);
                        }
                    }

                    byte[] respBytes = System.Text.Encoding.UTF8.GetBytes("{\"status\":\"saved\"}");
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = respBytes.Length;
                    ctx.Response.OutputStream.Write(respBytes, 0, respBytes.Length);
                    ctx.Response.OutputStream.Close();
                    return;
                }

                // 3. 로컬 디스크 파일 복원 로드 API (GET)
                if (rawUrl.Equals("api/load", StringComparison.OrdinalIgnoreCase))
                {
                    string savePath = Path.Combine(_baseDir, "data", "gnt_ledger_store.json");
                    string jsonContent = File.Exists(savePath) ? File.ReadAllText(savePath, System.Text.Encoding.UTF8) : "{}";
                    byte[] dataBytes = System.Text.Encoding.UTF8.GetBytes(jsonContent);
                    ctx.Response.ContentType = "application/json; charset=utf-8";
                    ctx.Response.ContentLength64 = dataBytes.Length;
                    ctx.Response.OutputStream.Write(dataBytes, 0, dataBytes.Length);
                    ctx.Response.OutputStream.Close();
                    return;
                }

                string filePath = Path.Combine(_baseDir, rawUrl.Replace('/', Path.DirectorySeparatorChar));

                if (File.Exists(filePath))
                {
                    byte[] fileBytes = File.ReadAllBytes(filePath);
                    ctx.Response.ContentType = GetContentType(filePath);
                    ctx.Response.ContentLength64 = fileBytes.Length;
                    ctx.Response.StatusCode = (int)HttpStatusCode.OK;
                    ctx.Response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                }
                else
                {
                    ctx.Response.StatusCode = (int)HttpStatusCode.NotFound;
                }
            }
            catch
            {
            }
            finally
            {
                try { ctx.Response.OutputStream.Close(); } catch { }
            }
        }

        private static string GetContentType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                default: return "application/octet-stream";
            }
        }

        private static int FindFreePort()
        {
            TcpListener l = new TcpListener(IPAddress.Loopback, 0);
            l.Start();
            int port = ((IPEndPoint)l.LocalEndpoint).Port;
            l.Stop();
            return port;
        }

        private static string GetBrowserPath()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (string p in candidates)
            {
                if (File.Exists(p)) return p;
            }
            return "msedge.exe";
        }

        private static void StartHeartbeatWatchdog(int initialGraceSeconds)
        {
            Thread watchdog = new Thread(delegate()
            {
                while (true)
                {
                    Thread.Sleep(3000);
                    // 초기 유예시간(45초) 경과 후 하트비트 검사
                    if ((DateTime.Now - _startTime).TotalSeconds > initialGraceSeconds)
                    {
                        // 프론트엔드가 15초 이상 핑을 보내지 않으면 창이 닫힌 것으로 판단
                        if ((DateTime.Now - _lastHeartbeat).TotalSeconds > 15)
                        {
                            _exitEvent.Set();
                            break;
                        }
                    }
                }
            });
            watchdog.IsBackground = true;
            watchdog.Start();
        }
    }
}
