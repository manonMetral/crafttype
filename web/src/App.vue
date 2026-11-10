<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ApiError, type Api } from './api';
import {
  addModule,
  inCatalogOrder,
  missingPrerequisites,
  presetValues,
  removeModule,
  sharedProperties,
  toRequest,
  type Basket,
} from './basket';
import BasketPanel from './BasketPanel.vue';
import { folderForName } from './folder';
import ModuleDetails from './ModuleDetails.vue';
import ModuleTree from './ModuleTree.vue';
import PreviewResult from './PreviewResult.vue';
import type { BasketPreview, Catalog, ConflictPolicy, ModuleInfo, ProjectState, PropertyValue } from './types';
import styles from './App.module.css';

const props = defineProps<{ api: Api | undefined }>();

interface Problem {
  message: string;
  hint?: string | undefined;
}
const describe = (error: unknown): Problem =>
  error instanceof ApiError
    ? { message: error.message, hint: error.hint }
    : { message: error instanceof Error ? error.message : String(error) };

const catalog = ref<Catalog>();
const project = ref<ProjectState>();
const problem = ref<Problem | undefined>(
  props.api === undefined
    ? {
        message: 'No token.',
        hint: 'Open the address that crafttype ui printed or opened: it carries the token this page needs.',
      }
    : undefined,
);

const folderInput = ref('');
const folderProblem = ref<Problem>();

const basket = ref<Basket>([]);
const selected = ref<string>();
/** What was typed in the options: a value that was cleared stays cleared, it is not filled in again. */
const edited = ref<Record<string, PropertyValue | undefined>>({});
const policy = ref<ConflictPolicy>('fail');

const preview = ref<BasketPreview>();
const previewing = ref(false);
const previewProblem = ref<Problem>();
let latestPreview = 0;

const loading = computed(
  () => problem.value === undefined && (catalog.value === undefined || project.value === undefined),
);

const applied = computed(() => new Set(project.value?.applied.map(({ slug }) => slug)));
const inBasket = computed(() => new Set(basket.value.map(({ slug }) => slug)));

/** The modules by group, in the order the catalog lists them. */
const groups = computed(() => {
  const byName = new Map<string, ModuleInfo[]>();
  for (const module of catalog.value?.modules ?? []) {
    byName.set(module.group, [...(byName.get(module.group) ?? []), module]);
  }
  return [...byName].map(([name, modules]) => ({ name, modules }));
});

const everything = computed(() => catalog.value ?? { modules: [] });
const items = computed(() =>
  inCatalogOrder(everything.value, basket.value).map(({ slug, auto }) => ({
    slug,
    auto,
    missing: missingPrerequisites(everything.value, applied.value, basket.value, slug),
  })),
);
const properties = computed(() => sharedProperties(everything.value, basket.value));
const values = computed(() => ({
  ...presetValues(everything.value, basket.value, project.value?.presets ?? {}),
  ...edited.value,
}));
/** The folder on screen is the one that is previewed: it is what the person sees and may have typed or derived. */
const request = computed(() =>
  toRequest(everything.value, basket.value, values.value, policy.value, folderInput.value),
);

const shown = computed(() => catalog.value?.modules.find(({ slug }) => slug === selected.value));
/** What putting the module that is looked at in the basket would bring with it. */
const alsoAdds = computed(() =>
  selected.value === undefined
    ? []
    : inCatalogOrder(everything.value, addModule(everything.value, applied.value, basket.value, selected.value))
        .map(({ slug }) => slug)
        .filter((slug) => slug !== selected.value && !inBasket.value.has(slug)),
);

// The answer is for one basket, one set of options, one policy and one folder: when they change it is no longer true,
// and the answer to a request still running is not wanted any more.
watch(
  () => JSON.stringify(request.value),
  () => {
    latestPreview += 1;
    preview.value = undefined;
    previewProblem.value = undefined;
    previewing.value = false;
  },
);

const toggle = (slug: string): void => {
  basket.value = inBasket.value.has(slug)
    ? removeModule(everything.value, basket.value, slug)
    : addModule(everything.value, applied.value, basket.value, slug);
};

const remove = (slug: string): void => {
  basket.value = removeModule(everything.value, basket.value, slug);
};

const NAME_KEY = 'projectName';
/** The pause after the last key before the project of the new folder is loaded. */
const RELOAD_DELAY_MS = 300;
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
let latestLoad = 0;

/** The project is named after its folder, and the folder follows the name: they are one thing seen twice. */
const followName = (name: PropertyValue | undefined): void => {
  const next = folderForName(folderInput.value, String(name ?? ''));
  if (next === undefined || next === folderInput.value) {
    return;
  }
  folderInput.value = next;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => void loadProject(), RELOAD_DELAY_MS);
};

const edit = (key: string, value: PropertyValue | undefined): void => {
  edited.value = { ...edited.value, [key]: value };
  if (key === NAME_KEY) {
    followName(value);
  }
};

const runPreview = async (): Promise<void> => {
  const current = ++latestPreview;
  previewing.value = true;
  previewProblem.value = undefined;
  try {
    const result = await (props.api as Api).preview(request.value);
    if (current === latestPreview) {
      preview.value = result;
    }
  } catch (error) {
    if (current === latestPreview) {
      previewProblem.value = describe(error);
    }
  } finally {
    if (current === latestPreview) {
      previewing.value = false;
    }
  }
};

const loadProject = async (): Promise<void> => {
  const current = ++latestLoad;
  folderProblem.value = undefined;
  try {
    const next = await (props.api as Api).project(folderInput.value);
    if (current !== latestLoad) {
      return;
    }
    project.value = next;
    // The modules that project already has are no longer something to apply, and what it lacks, that the other one
    // had, is what the modules of the basket now need.
    const has = new Set(next.applied.map(({ slug }) => slug));
    const rest = basket.value
      .filter(({ slug }) => has.has(slug))
      .reduce((kept, { slug }) => removeModule(everything.value, kept, slug), basket.value);
    basket.value = rest
      .filter(({ auto }) => !auto)
      .reduce((completed, { slug }) => addModule(everything.value, has, completed, slug), rest);
  } catch (error) {
    if (current === latestLoad) {
      folderProblem.value = describe(error);
    }
  }
};

onBeforeUnmount(() => clearTimeout(reloadTimer));

onMounted(async () => {
  if (props.api === undefined) {
    return;
  }
  try {
    [catalog.value, project.value] = await Promise.all([props.api.catalog(), props.api.project()]);
    folderInput.value = project.value.projectFolder;
  } catch (error) {
    problem.value = describe(error);
  }
});
</script>

<template>
  <header :class="styles.top">
    <h1 :class="styles.title">CraftType</h1>
    <form v-if="project" :class="styles.folder" @submit.prevent="loadProject">
      <label for="folder">Project folder</label>
      <input id="folder" v-model="folderInput" name="folder" type="text" autocomplete="off" />
      <button type="submit">Load</button>
    </form>
    <p v-if="folderProblem" role="alert" :class="styles.alert">
      <strong>Error:</strong> {{ folderProblem.message }}
      <span v-if="folderProblem.hint" :class="styles.hint">{{ folderProblem.hint }}</span>
    </p>
  </header>
  <main :class="styles.main">
    <p v-if="problem" role="alert" :class="styles.alert">
      <strong>Error:</strong> {{ problem.message }}
      <span v-if="problem.hint" :class="styles.hint">{{ problem.hint }}</span>
    </p>
    <p v-else-if="loading" role="status">Loading…</p>
    <div v-else :class="styles.layout">
      <section :class="styles.treeColumn" aria-label="Catalog">
        <h2>Modules</h2>
        <ModuleTree
          :groups="groups"
          :applied="applied"
          :in-basket="inBasket"
          :selected="selected"
          @select="selected = $event"
          @toggle="toggle"
        />
      </section>
      <ModuleDetails :module="shown" :applied="applied" :in-basket="inBasket" :also-adds="alsoAdds" @toggle="toggle" />
      <div :class="styles.basketColumn">
        <BasketPanel
          :items="items"
          :properties="properties"
          :values="values"
          :policy="policy"
          :loading="previewing"
          @remove="remove"
          @update-value="edit"
          @update-policy="policy = $event"
          @preview="runPreview"
        />
        <p v-if="previewProblem" role="alert" :class="styles.alert">
          <strong>Error:</strong> {{ previewProblem.message }}
          <span v-if="previewProblem.hint" :class="styles.hint">{{ previewProblem.hint }}</span>
        </p>
        <PreviewResult v-if="preview" :preview="preview" />
      </div>
    </div>
  </main>
</template>
