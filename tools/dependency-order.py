"""
Determines the order in which scripts should be concatenated by scanning JSLint
/*global ... */ declarations.
"""

import re
import sys

def slurp(path):
    with open(path) as f: return f.read()

DEPS_RE = re.compile(r'/\*global ([^*]+)\*/', re.M)

def js_dependencies(src):
    "Finds a script's dependencies as declared in a /*global...*/ block."
    match = DEPS_RE.search(slurp(src))
    return match and [dep.strip().split(':')[0] for dep in
                      match.group(1).split(',')]

def declaration_re(names):
    return re.compile(r'^var [^;]%(names)s|^function %(names)s' %
                        {'names': r'\b(%s)\b' % '|'.join(names)}, re.M)

def declaring_scripts(vars, scripts):
    "Finds the scripts that declare one or more of `vars'."
    if not vars: return []
    decl_re = declaration_re(vars)
    decls = {}
    for script in scripts:
        matches = decl_re.findall(slurp(script))
        if matches: decls[script] = [m[1] for m in matches]
    return decls

def remove(L, o):
    "Non-destructive list removal"
    copy = L[:]
    copy.remove(o)
    return copy

def dependency_graph(scripts):
    "Determines how scripts depend on each other."
    graph = {}
    for script in scripts:
        graph[script] = {}
        graph[script]['dependencies'] = \
            set(declaring_scripts(js_dependencies(script),
                                  remove(scripts, script)))
    for script in graph:
        graph[script]['dependents'] = \
            set(dependent for dependent in remove(graph.keys(), script)
                if script in graph[dependent]['dependencies'])
        # This is a bit crude, it only checks direct circular dependencies
        circular = graph[script]['dependencies'].intersection(graph[script]['dependents'])
        if circular:
            raise Exception('Circular dependency: %s contains %s '
                            'in dependents and dependencies' % (script, circular))
    return graph

def index(L, value, default=None):
    "Returns L.index(value) or default"
    try: return L.index(value)
    except ValueError: return default

def concatenation_order(graph):
    """
    Determines the order in which scripts must be concatenated to satisfy
    inter-script dependencies.
    """
    order = []
    for script in graph:
        # Insert after all dependencies
        dependency_indexes = [index(order, dependency, -1)
                              for dependency in graph[script]['dependencies']]
        min_index = max(dependency_indexes) + 1 if dependency_indexes else 0
        # ... and before all dependents
        dependent_indexes = [index(order, dependent, len(order))
                             for dependent in graph[script]['dependents']]
        max_index = min(dependent_indexes) if dependent_indexes else len(order)
        if max_index < min_index:
            # Shouldn't happen if dependency_graph is correct
            raise Exception('%s: max=%s, min=%s' % (script, max_index, min_index))
        # Either index is valid
        order.insert(min_index, script)
    return order

if __name__ == '__main__':
    print ' '.join(concatenation_order(dependency_graph(sys.argv[1:])))
