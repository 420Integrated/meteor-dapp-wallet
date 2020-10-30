updateHazeBadge = function() {
  var conf = PendingConfirmations.findOne({ operation: { $exists: true } });
  // set total balance in Haze menu, of no pending confirmation is Present
  if (typeof haze !== 'undefined' && (!conf || !conf.confirmedOwners.length)) {
    var accounts = FourtwentyAccounts.find({}).fetch();
    var wallets = Wallets.find({
      owners: { $in: _.pluck(accounts, 'address') }
    }).fetch();

    var balance = _.reduce(
      _.pluck(_.union(accounts, wallets), 'balance'),
      function(memo, num) {
        return memo + Number(num);
      },
      0
    );

    haze.menu.setBadge(
      FourtwentyTools.formatBalance(balance, '0.0 a', '420coin') + ' 420'
    );
  }
};

// ADD HAZE MENU
updateHazeMenu = function() {
  if (typeof haze === 'undefined') return;

  var accounts = _.union(
    Wallets.find({}, { sort: { name: 1 } }).fetch(),
    FourtwentyAccounts.find({}, { sort: { name: 1 } }).fetch()
  );

  // sort by balance
  accounts.sort(Helpers.sortByBalance);

  Meteor.setTimeout(function() {
    var routeName = FlowRouter.current().route.name;

    // add/update haze menu
    haze.menu.clear();
    haze.menu.add(
      'wallets',
      {
        position: 1,
        name: TAPi18n.__('wallet.app.buttons.wallet'),
        selected: routeName === 'dashboard'
      },
      function() {
        FlowRouter.go('/');
      }
    );
    haze.menu.add(
      'send',
      {
        position: 2,
        name: TAPi18n.__('wallet.app.buttons.send'),
        selected: routeName === 'send' || routeName === 'sendTo'
      },
      function() {
        FlowRouter.go('/send');
      }
    );

    _.each(accounts, function(account, index) {
      haze.menu.add(
        account._id,
        {
          position: 3 + index,
          name: account.name,
          badge:
            FourtwentyTools.formatBalance(account.balance, '0 a', '420coin') + ' 420',
          selected: location.pathname === '/account/' + account.address
        },
        function() {
          FlowRouter.go('/account/' + account.address);
        }
      );
    });

    // set total balance in header.js
  }, 10);
};

Meteor.startup(function() {
  // make reactive
  Tracker.autorun(updateHazeMenu);
});
