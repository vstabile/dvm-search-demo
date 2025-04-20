import { createRxForwardReq } from "rx-nostr";
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  merge,
  partition,
  share,
  Subject,
  tap,
} from "rxjs";
import {
  createSignal,
  For,
  from,
  Match,
  onCleanup,
  onMount,
  Switch,
} from "solid-js";
import { DVM_RELAY, KINDS, rxNostr } from "./lib/nostr";
import { waitForNip07 } from "./lib/utils";

export default function App() {
  const rxReq = createRxForwardReq();
  const [pubkey, setPubkey] = createSignal<string | null>(null);

  const inputChanges$ = new Subject<string>();
  const status$ = new Subject<"idle" | "searching" | "unavailable">();

  const status = from(status$);

  // Handle search result and feedback events separately
  const [jobResult$, jobFeedback$] = partition(
    rxNostr.use(rxReq, { on: { relays: [DVM_RELAY] } }).pipe(share()),
    ({ event }) => event.kind === KINDS.SEARCH_RESULT
  );

  const searchResult$ = merge(
    status$.pipe(
      filter((status) => status !== "idle"),
      map(() => [])
    ),
    jobResult$.pipe(
      map(({ event }) => {
        status$.next("idle");

        try {
          return JSON.parse(event.content);
        } catch (error) {
          console.error("Error parsing DVM response", error);
          return [];
        }
      })
    )
  );

  from(
    jobFeedback$.pipe(
      tap(({ event }) => {
        status$.next("unavailable");
        console.error("JOB_FEEDBACK", event);
      })
    )
  );

  const searchResult = from(searchResult$);

  async function handleSearchRequest(query: string) {
    status$.next("searching");

    // Build and sign the Search job request event
    const event = await window.nostr!.signEvent!({
      kind: KINDS.SEARCH_REQUEST,
      content: "",
      tags: [["param", "search", query]],
      created_at: Math.floor(Date.now() / 1000),
    });

    // Subscribe to the job response
    rxReq.emit([
      {
        kinds: [KINDS.SEARCH_RESULT, KINDS.JOB_FEEDBACK],
        "#e": [event.id],
      },
    ]);

    // The following line will only work with an adequate timeout
    // so that the event is sent after the subscription is set up
    setTimeout(() => {
      rxNostr.send(event, { on: { relays: [DVM_RELAY] } });
    }, 2000);
  }

  onMount(() => {
    // Handle the input changes and search requests
    const inputSubscription = inputChanges$
      .pipe(debounceTime(500), distinctUntilChanged())
      .subscribe((query) => handleSearchRequest(query));

    waitForNip07().then((available) => {
      if (!available) return;

      window.nostr!.getPublicKey!().then((pubkey) => setPubkey(pubkey));
    });

    onCleanup(() => {
      inputSubscription.unsubscribe();
      inputChanges$.complete();
      status$.complete();
    });
  });

  return (
    <div>
      <Switch>
        <Match when={pubkey()}>
          <input
            type="text"
            onInput={(e) => inputChanges$.next(e.target.value)}
          />
        </Match>
        <Match when={!pubkey()}>
          <div>You need to sign in with NIP-07 to search.</div>
        </Match>
      </Switch>
      {status() && status() !== "idle" && <div>{status()}...</div>}
      <ul>
        <For each={searchResult()}>
          {(result) => (
            <li>
              {result.pubkey} ({result.rank})
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
