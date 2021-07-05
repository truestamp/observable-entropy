SRC := cli.ts
LOCK := lock.json
DENO_DIR := ./deno_dir
ARGS := --unstable --allow-env --allow-net --allow-read --allow-write --lock=${LOCK} --cached-only

.PHONY: lock
lock:
	export DENO_DIR=${DENO_DIR} && deno cache --unstable --lock=${LOCK} --lock-write ${SRC}

.PHONY: cache
cache:
	make cache-system && export DENO_DIR=${DENO_DIR} && deno cache --unstable ${SRC} && make lock

.PHONY: cache-reload
cache-reload:
	export DENO_DIR=${DENO_DIR} && deno cache --unstable --reload ${SRC} && make lock

.PHONY: cache-system
cache-system:
	deno cache --unstable ${SRC}

.PHONY: clean
clean:
	export DENO_DIR=${DENO_DIR} && deno run ${ARGS} ${SRC} --clean

.PHONY: collect
collect:
	export DENO_DIR=${DENO_DIR} && deno run ${ARGS} ${SRC} --collect

.PHONY: generate
generate:
	export DENO_DIR=${DENO_DIR} && deno run ${ARGS} ${SRC} --entropy-generate

.PHONY: verify
verify:
	export DENO_DIR=${DENO_DIR} && deno run ${ARGS} ${SRC} --entropy-verify

.PHONY: index
index:
	export DENO_DIR=${DENO_DIR} && deno run ${ARGS} ${SRC} --entropy-index

