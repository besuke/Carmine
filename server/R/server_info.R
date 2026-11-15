# The connection page's API (GET /api/server): what the calculation server is, where it listens, how long it
# has run, which routes it answers, and one small RiemannFinMath calculation timed on the server, so that the
# page can tell the time on the network from the time of the calculation.

SERVER_STARTED <- Sys.time()
SERVER_REQUESTS <- new.env()
SERVER_REQUESTS$count <- 0L

# Every route of server/server.R, for the page's table. Keep in step with handle().
SERVER_ROUTES <- tibble::tribble(
  ~method, ~path,                             ~page,
  "GET",  "/api/health",                     "接続の確認",
  "GET",  "/api/server",                     "計算サーバーとの接続（このページ）",
  "POST", "/api/scenario",                   "イールドカーブと円OIS",
  "POST", "/api/curves/zero",                "金利カーブ",
  "GET",  "/api/jgb-curves",                 "金利カーブ（国債利回りの推移）",
  "POST", "/api/futures/basket",             "日本国債先物・CTD",
  "POST", "/api/cds",                        "信用リスクとCDS",
  "POST", "/api/black",                      "ブラックモデル",
  "POST", "/api/bond",                       "確定キャッシュフロー",
  "POST", "/api/calibration",                "金利デリバティブのキャリブレーション",
  "POST", "/api/rate-models",                "金利モデル",
  "POST", "/api/callable",                   "早期償還モデル",
  "POST", "/api/prdc",                       "金利為替系デリバティブ（PRDC）",
  "POST", "/api/parallel",                   "計算の進化と並列計算",
  "POST", "/api/prdc-risk",                  "PRDC のリスク計算",
  "POST", "/api/prdc-risk/job",              "PRDC のリスク計算（分散ジョブ）",
  "GET",  "/api/asw/offers",                 "OISアセットスワップ・オファーシート",
  "GET",  "/api/asw/offers/<id>",            "OISアセットスワップ・オファーシート",
  "POST", "/api/asw/offers/<id>/jgb-spread", "OISアセットスワップ・オファーシート",
  "GET",  "/api/asw/report",                 "オファーシート作成 POC"
)

# One small calculation in RiemannFinMath, repeated to measure it: mean and covariance of 60 x 4 returns.
server_probe <- function(repeats = 20L) {
  returns <- matrix(sin(seq_len(240)) / 50, 60, 4, dimnames = list(NULL, c("a", "b", "c", "d")))
  t0 <- as.numeric(Sys.time())
  runs <- purrr::map(seq_len(repeats), \(k) RiemannFinMath::compute_return_moments(returns))
  seconds <- (as.numeric(Sys.time()) - t0) / repeats
  list(calculation = "RiemannFinMath::compute_return_moments（60期間 × 4資産）", repeats = repeats,
       seconds_each = seconds, check_value = unname(purrr::pluck(runs, repeats, "mean", "a")))
}

server_info <- function(host, port, static_dir) {
  now <- Sys.time()
  list(
    status = "ok",
    engine = list(name = "RiemannFinMath", version = as.character(utils::packageVersion("RiemannFinMath")),
                  library = dirname(system.file(package = "RiemannFinMath"))),
    runtime = list(r_version = paste(R.version$major, R.version$minor, sep = "."), platform = R.version$platform,
                   pid = Sys.getpid(), logical_processors = parallel::detectCores(logical = TRUE)),
    listen = list(host = host, port = port, lan = identical(host, "0.0.0.0"), serves_page = !is.na(static_dir)),
    started_at = format(SERVER_STARTED, "%Y-%m-%dT%H:%M:%S%z"),
    server_time = format(now, "%Y-%m-%dT%H:%M:%S%z"),
    uptime_seconds = as.numeric(difftime(now, SERVER_STARTED, units = "secs")),
    requests_served = SERVER_REQUESTS$count,
    probe = server_probe(),
    routes = SERVER_ROUTES
  )
}
