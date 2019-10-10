import {RawHoister, HoistedTree} from '../sources/RawHoister';

const sortDeps = (tree: HoistedTree): HoistedTree =>
  // Sort deps of each node
  tree.map(deps => deps ? new Set(Array.from(deps).sort()) : deps);

describe('RawHoister', () => {
  const hoister = new RawHoister();

  it('should be able to hoist empty tree', () => {
    expect(hoister.hoist([], [])).toEqual([]);
    expect(hoister.hoist([{deps: new Set(), peerDeps: new Set()}], [])).toEqual([new Set()]);
  });

  it('should do very basic hoisting', () => {
    const tree = [
      {deps: new Set([1]), peerDeps: new Set<number>()},
      {deps: new Set([2]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 2]),
      new Set(),
      new Set(),
    ]);
  });

  it('should not hoist different package with the same name', () => {
    const tree = [
      {deps: new Set([1, 3]), peerDeps: new Set<number>()},
      {deps: new Set([2]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 3]),
      new Set([2]),
      new Set(),
      new Set(),
    ]);
  });

  it('should not hoist package that has several versions on the same tree path', () => {
    // . → A → B@X → C → B@Y, B@Y should not be hoisted
    const tree = [
      {deps: new Set([1]), peerDeps: new Set<number>()},
      {deps: new Set([2]), peerDeps: new Set<number>()},
      {deps: new Set([3]), peerDeps: new Set<number>()},
      {deps: new Set([4]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: '.', weight: 1},
      {name: 'A', weight: 1},
      {name: 'B', weight: 1},
      {name: 'C', weight: 1},
      {name: 'B', weight: 100},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 2, 3]),
      new Set(),
      new Set(),
      new Set([4]),
      new Set(),
    ]);
  });

  it('should perform deep hoisting', () => {
    const tree = [
      {deps: new Set([1, 3, 4]), peerDeps: new Set<number>()},
      {deps: new Set([2, 4]), peerDeps: new Set<number>()},
      {deps: new Set([5]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 1},
      {name: 'lodash', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 3, 4]),
      new Set([2, 5]),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
    ]);
  });

  it('should tolerate any cyclic dependencies', () => {
    const tree = [
      {deps: new Set([0, 1, 3, 4]), peerDeps: new Set<number>()},
      {deps: new Set([1, 2, 4]), peerDeps: new Set<number>()},
      {deps: new Set([2, 5]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 1},
      {name: 'lodash', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([0, 1, 3, 4]),
      new Set([2, 5]),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
    ]);
  });

  it('should honor weight when hoisting', () => {
    const tree = [
      {deps: new Set([1]), peerDeps: new Set<number>()},
      {deps: new Set([2, 3, 5]), peerDeps: new Set<number>()},
      {deps: new Set([4]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set([4]), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: 'app', weight: 1},
      {name: 'webpack', weight: 1},
      {name: 'watchpack', weight: 1},
      {name: 'lodash', weight: 3},
      {name: 'lodash', weight: 1},
      {name: 'enhanced-resolve', weight: 1},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 2, 3, 5]),
      new Set(),
      new Set([4]),
      new Set(),
      new Set(),
      new Set([4]),
    ]);
  });

  it('should honor peer dependencies', () => {
    // . -> A -> B -p> D(@X)
    //        -> C -> D@Y
    //        -> D@X
    // Should be hoisted to (A and B should share single D@X dependency):
    // . -> A -> B
    //        -> D(@X)
    //   -> C
    //   -> D@Y
    const tree = [
      {deps: new Set([1]), peerDeps: new Set<number>()},
      {deps: new Set([2, 3, 4]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set([4])},
      {deps: new Set([5]), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
      {deps: new Set<number>(), peerDeps: new Set<number>()},
    ];
    const packages = [
      {name: '.', weight: 1},
      {name: 'A', weight: 1},
      {name: 'B', weight: 1},
      {name: 'C', weight: 1},
      {name: 'D', weight: 1},
      {name: 'D', weight: 100},
    ];
    const result = hoister.hoist(tree, packages);
    expect(sortDeps(result)).toEqual([
      new Set([1, 3, 5]),
      new Set([2, 4]),
      new Set(),
      new Set(),
      new Set(),
      new Set(),
    ]);
  });
});