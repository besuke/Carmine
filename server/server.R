# HTTP API for LagrangeFinLab (httpuv). By default it listens on 127.0.0.1 only.
#
#   Rscript server/server.R [--port 8787] [--host 127.0.0.1] [--static dist]
#
#   --host 0.0.0.0  listen on every network interface (company LAN; see README "社内LANで使う")
#   --static DIR    also serve the built page (npm run build) from DIR, so page and API share one port
#
#   GET  /api/health    -> {"status":"ok", ...}
#   POST /api/scenario  {"bumpTenor":"5Y","bumpBp":1} -> curves, 7Y OIS par rate and PVs (see README.md)
#   POST /api/curves/zero         {"zeroRatesPct":[...], "shiftBp":50} -> zero / discount / shifted curves (II-2)
#   POST /api/futures/basket      {"mode":"current"} | {"mode":"flat","yieldPct":8,"fundingPct":9} -> CTD, basis, futures BPV
#   POST /api/cds                 {"flat":{"spreadBp":130,...},"isda":{"spreadBp":30.426,...}} -> CDS legs, hazard, ISDA (II-5)
#   POST /api/black               {"black":{...},"mc":{"sequence":"pseudo","paths":200},"bsm":{...},"lsm":{"paths":2048}} -> II-4
#   POST /api/bond                {"shapes":{...},"bond":{"simpleYieldPct":6.515,"couponPct":7.5,"zSpreadBp":50}} -> II-1
#   POST /api/calibration         {"normal":{...},"sabr":{"beta":0.5},"hw":{...},"bgm":{"decay":0.45}} -> II-6
#   GET  /api/asw/offers          -> the ASW offer sheet (Curie demo data)
#   GET  /api/asw/offers/<id>     -> one offer: curve, price conversion, cash flows, ASW components

suppressPackageStartupMessages({
  library(httpuv)
  library(jsonlite)
})

script_dir <- local({
  arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
  if (length(arg)) dirname(normalizePath(sub("^--file=", "", arg[1L]), winslash = "/")) else getwd()
})
source(file.path(script_dir, "R", "tona_ois_model.R"))
source(file.path(script_dir, "R", "asw_model.R"))
source(file.path(script_dir, "R", "asw_report.R"))
source(file.path(script_dir, "R", "curve_model.R"))
source(file.path(script_dir, "R", "futures_model.R"))
source(file.path(script_dir, "R", "cds_model.R"))
source(file.path(script_dir, "R", "black_model.R"))
source(file.path(script_dir, "R", "bond_model.R"))
source(file.path(script_dir, "R", "calibration_model.R"))
# the demo data do not change while the server runs
ASW_LIST <- asw_list()
ASW_REPORT <- asw_report()

args <- commandArgs(trailingOnly = TRUE)
arg_value <- function(name, default) {
  i <- which(args == name)
  if (length(i) && length(args) > i) args[i + 1L] else default
}
port <- as.integer(arg_value("--port", "8787"))
host <- arg_value("--host", "127.0.0.1")
static_dir <- arg_value("--static", NA_character_)
if (!is.na(static_dir)) {
  static_dir <- normalizePath(static_dir, winslash = "/", mustWork = FALSE)
  if (!file.exists(file.path(static_dir, "index.html"))) stop("No index.html in ", static_dir, ". Run npm run build first.")
}

json_response <- function(status, body, request_id = NULL) {
  headers <- list("Content-Type" = "application/json; charset=utf-8", "Cache-Control" = "no-store")
  if (!is.null(request_id)) headers[["X-Request-Id"]] <- request_id
  list(status = as.integer(status), headers = headers,
       body = if (is.character(body)) body else as.character(tona_to_json(body)))
}

# X-Request-Id from the client (1-64 characters of letters, digits, '-' and '_'); otherwise a random one.
request_id <- function(req) {
  id <- req$HTTP_X_REQUEST_ID
  if (is.character(id) && length(id) == 1L && grepl("^[A-Za-z0-9_-]{1,64}$", id)) return(id)
  paste0("srv-", paste(sample(c(0:9, letters[1:6]), 16L, replace = TRUE), collapse = ""))
}

read_body <- function(req) {
  input <- req$rook.input
  if (is.null(input)) return("")
  raw <- input$read()
  if (length(raw) == 0L) "" else rawToChar(raw)
}

handle <- function(req) {
  method <- req$REQUEST_METHOD
  path <- req$PATH_INFO
  if (identical(path, "/api/health")) {
    if (method != "GET") return(json_response(405, list(error = "Use GET.")))
    return(json_response(200, list(
      status = "ok", engine = paste("RiemannFinMath", as.character(utils::packageVersion("RiemannFinMath"))),
      evaluation_date = format(TONA_MODEL$evaluation_date), fixed_rate = TONA_FIXED_RATE
    )))
  }
  if (identical(path, "/api/scenario")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object such as {\"bumpTenor\":\"5Y\",\"bumpBp\":1}.")))
    unknown <- setdiff(names(body), c("bumpTenor", "bumpBp"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(
      tona_compute_scenario(body$bumpTenor, body$bumpBp),
      tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
      error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed")
    )
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    # The request ID is echoed back, so the page can show that its charts and PV come from the same response.
    # The server keeps no state: the ID comes from the X-Request-Id header, or is drawn here when absent.
    result$response <- list(request_id = request_id(req), computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = result$response$request_id))
  }
  # OIS asset swap offer sheet (Curie's demo data, read-only)
  # Zero-rate nodes to curves (yield-curve chapter)
  if (identical(path, "/api/curves/zero")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"shiftBp\":50}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("zeroRatesPct", "shiftBp"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(curve_compute(body$zeroRatesPct, if (is.null(body$shiftBp)) 50 else body$shiftBp),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  # JGB futures, CTD and futures BPV (II-2.6–2.7)
  if (identical(path, "/api/futures/basket")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"mode\":\"current\"}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("mode", "yieldPct", "fundingPct"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(fut_compute(if (is.null(body$mode)) "current" else body$mode, if (is.null(body$yieldPct)) 8 else body$yieldPct, body$fundingPct),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  # Credit risk and CDS (II-5)
  if (identical(path, "/api/cds")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"flat\":{\"spreadBp\":130}}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("flat", "isda"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(cds_compute(body),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  # Black model (II-4)
  if (identical(path, "/api/black")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"mc\":{\"paths\":2000}}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("black", "mc", "bsm", "lsm"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(black_compute(body),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  # Deterministic cash flows (II-1)
  if (identical(path, "/api/bond")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"bond\":{\"simpleYieldPct\":6.515}}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("shapes", "bond"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(bond_compute(body),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  # Calibration of interest-rate derivatives (II-6)
  if (identical(path, "/api/calibration")) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"sabr\":{\"beta\":0.5}}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body)) return(json_response(400, list(error = "The body must be a JSON object.")))
    unknown <- setdiff(names(body), c("normal", "sabr", "hw", "bgm"))
    if (length(unknown)) return(json_response(400, list(error = paste("Unknown fields:", paste(unknown, collapse = ", ")))))
    result <- tryCatch(calibration_compute(body),
                       tona_bad_request = function(e) structure(list(error = conditionMessage(e)), class = "bad"),
                       error = function(e) structure(list(error = paste("Calculation failed:", conditionMessage(e))), class = "failed"))
    if (inherits(result, "bad")) return(json_response(400, unclass(result)))
    if (inherits(result, "failed")) return(json_response(500, unclass(result)))
    id <- request_id(req)
    result$response <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, result, request_id = id))
  }
  if (identical(path, "/api/asw/report")) {
    if (method != "GET") return(json_response(405, list(error = "Use GET.")))
    id <- request_id(req)
    stamp <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    return(json_response(200, c(ASW_REPORT, list(response = stamp)), request_id = id))
  }
  # A quote given as a spread over JGBs, converted to a price (yen bonds only)
  if (grepl("^/api/asw/offers/[A-Za-z0-9_-]{1,32}/jgb-spread$", path)) {
    if (method != "POST") return(json_response(405, list(error = "Use POST with a JSON body such as {\"spreadBp\":11.5}.")))
    body <- tryCatch(jsonlite::fromJSON(read_body(req), simplifyVector = TRUE), error = function(e) NULL)
    if (!is.list(body) || !identical(names(body), "spreadBp")) return(json_response(400, list(error = "The body must be {\"spreadBp\": <number>}.")))
    out <- asw_jgb_spread_quote(sub("^/api/asw/offers/([^/]+)/jgb-spread$", "\\1", path), body$spreadBp)
    id <- request_id(req)
    if (out$status != 200L) return(json_response(out$status, out$body))
    return(json_response(200, c(out$body, list(response = list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z")))), request_id = id))
  }
  if (identical(path, "/api/asw/offers") || startsWith(path, "/api/asw/offers/")) {
    if (method != "GET") return(json_response(405, list(error = "Use GET.")))
    id <- request_id(req)
    stamp <- list(request_id = id, computed_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%OS3%z"))
    if (identical(path, "/api/asw/offers")) {
      return(json_response(200, c(ASW_LIST, list(response = stamp)), request_id = id))
    }
    offer_id <- utils::URLdecode(sub("^/api/asw/offers/", "", path))
    if (!grepl("^[A-Za-z0-9_-]{1,32}$", offer_id)) return(json_response(400, list(error = "Invalid offer id.")))
    detail <- asw_detail(offer_id)
    if (is.null(detail)) return(json_response(404, list(error = paste("No such offer:", offer_id))))
    return(json_response(200, c(detail, list(response = stamp)), request_id = id))
  }
  json_response(404, list(error = paste("Not found:", path)))
}

app <- list(call = function(req) {
  tryCatch(handle(req), error = function(e) json_response(500, list(error = conditionMessage(e))))
})
if (!is.na(static_dir)) {
  # GET of the page and its assets is served from the build; /api always goes to handle().
  app$staticPaths <- list(
    "/" = httpuv::staticPath(static_dir, indexhtml = TRUE, fallthrough = TRUE),
    "/api" = httpuv::excludeStaticPath()
  )
}

# IPv4 addresses of this PC, to tell other PCs where to connect (best effort, Windows only).
lan_addresses <- function() {
  cmd <- "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' }).IPAddress"
  out <- tryCatch(suppressWarnings(system2("powershell", c("-NoProfile", "-Command", shQuote(cmd)), stdout = TRUE, stderr = FALSE)),
                  error = function(e) character())
  out[grepl("^\\d+\\.\\d+\\.\\d+\\.\\d+$", trimws(out))]
}

cat(sprintf("LagrangeFinLab API on http://%s:%d (RiemannFinMath %s, fixed rate %.17g)\n",
            host, port, as.character(utils::packageVersion("RiemannFinMath")), TONA_FIXED_RATE))
if (!is.na(static_dir)) cat("Serving the page from", static_dir, "\n")
if (host == "0.0.0.0") {
  ips <- trimws(lan_addresses())
  cat("Listening on every network interface. Other PCs on the LAN can open:\n")
  for (ip in ips) cat(sprintf("  http://%s:%d/\n", ip, port))
  if (!length(ips)) cat(sprintf("  http://<this PC's IP address>:%d/\n", port))
}
flush.console()
httpuv::runServer(host, port, app)
